import Link from "next/link";
import { PageHead } from "@/components/site/PageHead";

export default function NotFound() {
  return (
    <div className="pb-16">
      <PageHead eyebrow="404 / signal lost" title="No agent here.">
        <p>This page does not exist.</p>
      </PageHead>
      <div className="edge flex flex-wrap gap-3">
        <Link href="/room" className="btn solid">
          Control room
        </Link>
        <Link href="/" className="btn">
          Home
        </Link>
      </div>
    </div>
  );
}
