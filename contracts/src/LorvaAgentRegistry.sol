// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {LorvaLimitMath as M} from "./LorvaLimitMath.sol";

/// @title LorvaAgentRegistry
/// @notice On-chain records of trading agents built in Lorva Agent. Each agent belongs to the wallet that registered it and carries:
///         a config hash (its rules), versioned limits, one bound operator key (the engine that acts for it in paper mode), a
///         status (Active, Paused, Killed) and per-day usage. The operator records each paper action; the registry counts trades and
///         realised loss per UTC day and refuses anything over the limits. The events are the agent's public timeline.
///
///         It moves no money: nothing is payable, nothing is transferred, no fee, no admin over anyone's agent, no upgrade. Real-money
///         trading through a vault is a concept and is not here. The operator can never raise a limit; it can only tighten them.
contract LorvaAgentRegistry {
    enum Status {
        None,
        Active,
        Paused,
        Killed
    }

    struct Agent {
        address owner;
        address operator;
        Status status;
        uint32 version; // limits version, starts at 1
        uint64 createdAt;
        bytes32 configHash;
        M.Limits limits;
    }

    struct Usage {
        uint32 day;
        uint16 trades;
        uint64 loss;
        uint64 position;
        uint64 actions; // all-time
    }

    uint16 public constant MAX_BATCH = 32;

    uint256 public agentCount;
    mapping(uint256 => Agent) internal _agents;
    mapping(uint256 => Usage) internal _usage;
    mapping(address => uint256[]) internal _byOwner;

    event AgentRegistered(uint256 indexed agent, address indexed owner, address indexed operator, bytes32 configHash, uint64 maxPosition, uint64 maxDailyLoss, uint16 maxTradesPerDay, uint16 stopLossBps, uint64 validUntil);
    event LimitsChanged(uint256 indexed agent, uint32 indexed version, bytes32 configHash, uint64 maxPosition, uint64 maxDailyLoss, uint16 maxTradesPerDay, uint16 stopLossBps, uint64 validUntil, address by);
    event OperatorChanged(uint256 indexed agent, address indexed operator);
    event StatusChanged(uint256 indexed agent, Status status, address by);
    event ActionRecorded(uint256 indexed agent, uint32 indexed day, bytes32 actionHash, uint32 version, uint64 positionAfter, int64 realisedPnl, uint16 tradesToday, uint64 lossToday);

    error UnknownAgent();
    error NotOwner();
    error NotOwnerOrOperator();
    error BadLimits(uint256 reasons);
    error Refused(uint256 reasons);
    error AlreadyKilled();
    error BadStatus();
    error NotTighter();
    error BatchTooLarge();

    modifier onlyOwner(uint256 id) {
        Agent storage a = _agents[id];
        if (a.owner == address(0)) revert UnknownAgent();
        if (a.owner != msg.sender) revert NotOwner();
        _;
    }

    // ------------------------------------------------------------------ owner
    function register(bytes32 configHash, M.Limits calldata limits, address operator) external returns (uint256 id) {
        uint256 r = M.check(limits, block.timestamp);
        if (r != 0) revert BadLimits(r);
        id = ++agentCount;
        Agent storage a = _agents[id];
        a.owner = msg.sender;
        a.operator = operator;
        a.status = Status.Active;
        a.version = 1;
        a.createdAt = uint64(block.timestamp);
        a.configHash = configHash;
        a.limits = limits;
        _byOwner[msg.sender].push(id);
        emit AgentRegistered(id, msg.sender, operator, configHash, limits.maxPosition, limits.maxDailyLoss, limits.maxTradesPerDay, limits.stopLossBps, limits.validUntil);
    }

    /// @notice A new limits version (and rules hash). Only the owner; a killed agent stays killed.
    function setLimits(uint256 id, bytes32 configHash, M.Limits calldata limits) external onlyOwner(id) {
        Agent storage a = _agents[id];
        if (a.status == Status.Killed) revert AlreadyKilled();
        uint256 r = M.check(limits, block.timestamp);
        if (r != 0) revert BadLimits(r);
        _setLimits(a, id, configHash, limits);
    }

    /// @notice The operator may only tighten (never raise) the limits, e.g. when its engine sees trouble.
    function tighten(uint256 id, M.Limits calldata limits) external {
        Agent storage a = _agents[id];
        if (a.owner == address(0)) revert UnknownAgent();
        if (msg.sender != a.operator && msg.sender != a.owner) revert NotOwnerOrOperator();
        if (a.status == Status.Killed) revert AlreadyKilled();
        if (!M.tighterOrEqual(a.limits, limits)) revert NotTighter();
        uint256 r = M.check(limits, block.timestamp);
        if (r != 0) revert BadLimits(r);
        _setLimits(a, id, a.configHash, limits);
    }

    function _setLimits(Agent storage a, uint256 id, bytes32 configHash, M.Limits memory limits) internal {
        a.limits = limits;
        a.configHash = configHash;
        a.version += 1;
        emit LimitsChanged(id, a.version, configHash, limits.maxPosition, limits.maxDailyLoss, limits.maxTradesPerDay, limits.stopLossBps, limits.validUntil, msg.sender);
    }

    function setOperator(uint256 id, address operator) external onlyOwner(id) {
        if (_agents[id].status == Status.Killed) revert AlreadyKilled();
        _agents[id].operator = operator;
        emit OperatorChanged(id, operator);
    }

    /// @notice Pause takes effect in this block: canAct refuses from now on. The operator may pause too (never resume).
    function pause(uint256 id) external {
        Agent storage a = _agents[id];
        if (a.owner == address(0)) revert UnknownAgent();
        if (msg.sender != a.owner && msg.sender != a.operator) revert NotOwnerOrOperator();
        if (a.status != Status.Active) revert BadStatus();
        a.status = Status.Paused;
        emit StatusChanged(id, Status.Paused, msg.sender);
    }

    function resume(uint256 id) external onlyOwner(id) {
        Agent storage a = _agents[id];
        if (a.status != Status.Paused) revert BadStatus();
        a.status = Status.Active;
        emit StatusChanged(id, Status.Active, msg.sender);
    }

    /// @notice The kill switch: final, in one transaction, also unbinds the operator.
    function kill(uint256 id) external onlyOwner(id) {
        _kill(id);
    }

    /// @notice Kills several of the caller's agents in one transaction (all must belong to the caller, or nothing happens).
    function killMany(uint256[] calldata ids) external {
        if (ids.length > MAX_BATCH) revert BatchTooLarge();
        for (uint256 i = 0; i < ids.length; i++) {
            Agent storage a = _agents[ids[i]];
            if (a.owner == address(0)) revert UnknownAgent();
            if (a.owner != msg.sender) revert NotOwner();
            if (a.status != Status.Killed) _kill(ids[i]);
        }
    }

    function _kill(uint256 id) internal {
        Agent storage a = _agents[id];
        if (a.status == Status.Killed) revert AlreadyKilled();
        a.status = Status.Killed;
        a.operator = address(0);
        emit OperatorChanged(id, address(0));
        emit StatusChanged(id, Status.Killed, msg.sender);
    }

    // ------------------------------------------------------------------ operator
    /// @notice Reasons `who` may not record an action that leaves the position at `positionAfter` (0 = allowed). Actions that
    ///         lower the position (exits, stop-losses) are always allowed for an active agent's operator.
    ///         `version` must equal the agent's current limits version, so an engine running old limits is stopped.
    function canAct(uint256 id, address who, uint32 version, uint64 positionAfter) public view returns (uint256 r) {
        Agent storage a = _agents[id];
        if (a.owner == address(0)) return M.R_UNKNOWN_AGENT;
        if (who != a.operator || who == address(0)) r |= M.R_NOT_OPERATOR;
        if (a.status == Status.Paused) r |= M.R_PAUSED;
        if (a.status == Status.Killed) r |= M.R_KILLED;
        if (version != a.version) r |= M.R_STALE_VERSION;
        Usage storage u = _usage[id];
        // Limits stop new risk; they never block an exit. An action that lowers the position is checked only for operator and status.
        if (positionAfter < u.position) return r;
        uint32 today = M.day(block.timestamp);
        (uint16 trades, uint64 loss) = u.day == today ? (u.trades, u.loss) : (uint16(0), uint64(0));
        r |= M.actReasons(a.limits, block.timestamp, positionAfter, trades, loss);
    }

    /// @notice The operator records one paper action. realisedPnl < 0 adds to today's loss. Refused actions revert with every reason.
    function recordAction(uint256 id, uint32 version, bytes32 actionHash, uint64 positionAfter, int64 realisedPnl) external {
        if (actionHash == bytes32(0)) revert Refused(M.R_ZERO_ACTION);
        uint256 r = canAct(id, msg.sender, version, positionAfter);
        if (r != 0) revert Refused(r);
        Usage storage u = _usage[id];
        uint32 today = M.day(block.timestamp);
        if (u.day != today) {
            u.day = today;
            u.trades = 0;
            u.loss = 0;
        }
        u.trades += 1;
        if (realisedPnl < 0) u.loss += uint64(-int64(realisedPnl));
        u.position = positionAfter;
        u.actions += 1;
        emit ActionRecorded(id, today, actionHash, version, positionAfter, realisedPnl, u.trades, u.loss);
    }

    // ------------------------------------------------------------------ views
    function agentOf(uint256 id) external view returns (Agent memory) {
        return _agents[id];
    }

    /// @notice Today's usage (zeroed when the stored day is not today).
    function usageOf(uint256 id) external view returns (Usage memory u) {
        u = _usage[id];
        if (u.day != M.day(block.timestamp)) {
            u.trades = 0;
            u.loss = 0;
            u.day = M.day(block.timestamp);
        }
    }

    function agentsOf(address owner) external view returns (uint256[] memory) {
        return _byOwner[owner];
    }
}
