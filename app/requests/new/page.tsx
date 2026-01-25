'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import IntentCard from './components/IntentCard';
import MotionWrapper from '@/components/motion/MotionWrapper'

const fastPathOptions = [
  {
    id: 'job_posting',
    title: 'Hire a contingent worker',
    description: 'Temporary, staff aug, freelancers, etc.',
    icon: '🧑‍💼',
  },
  {
    id: 'sow',
    title: 'Initiate a Statement of Work (SOW)',
    description: 'Defined outcomes, milestones, or deliverables',
    icon: '📝',
  },
  {
    id: 'sourcing',
    title: 'Launch a Sourcing Event',
    description: 'I want procurement involved before deciding',
    icon: '🔍',
  },
];

export default function NewRequestPage() {
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const router = useRouter();

  const handleContinue = () => {
    if (selectedIntent) {
      router.push(`/requests/new/${selectedIntent}`);
    }
  };

 return (
  <MotionWrapper>
    <div className="max-w-6xl mx-auto px-8 py-6 space-y-8">
      {/* ✅ Back to Home */}
      <div>
        <a
          href="/"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          ← Back to Home
        </a>
      </div>

      {/* ✅ Title */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          What are you trying to get done?
        </h1>
        <p className="text-sm text-slate-500">
          Choose a path below or let Nova guide you.
        </p>
      </div>

      {/* ✅ Fast Paths */}
      <div className="space-y-3">
        <h2 className="text-base font-medium text-slate-700">
          I know what I need
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {fastPathOptions.map((option) => (
            <IntentCard
              key={option.id}
              id={option.id}
              title={option.title}
              description={option.description}
              icon={option.icon}
              selected={selectedIntent === option.id}
              onSelect={() => setSelectedIntent(option.id)}
            />
          ))}
        </div>
      </div>

      {/* ✅ Guided Option */}
      <div className="space-y-3 pt-4">
        <h2 className="text-base font-medium text-slate-700">
          I’m not sure
        </h2>
        <div>
          <IntentCard
            id="guided"
            title="Let Nova guide me"
            description="Answer a few questions and we'll recommend the best path."
            icon="✨"
            selected={selectedIntent === 'guided'}
            onSelect={() => setSelectedIntent('guided')}
          />
        </div>
      </div>

      {/* ✅ Continue Button */}
      {selectedIntent && (
        <div className="pt-8 flex justify-end">
          <button
            onClick={handleContinue}
            className="
              px-6 py-2.5
              bg-slate-900 text-white
              rounded-full
              text-sm font-medium
              hover:bg-slate-800
              transition-colors
            "
          >
            Continue    
          </button>
        </div>
      )}
        </div>
  </MotionWrapper>
);
}
