'use client';

import Link from 'next/link';

export default function InitiateRequestButton() {
  return (
    <Link href="/requests/new">
      <button
        className="
          bg-slate-900 text-white
          px-5 py-2.5
          rounded-full
          text-sm font-medium
          shadow-sm
          hover:bg-slate-800
          transition-colors
        "
      >
        Initiate Request
      </button>
    </Link>
  );
}
