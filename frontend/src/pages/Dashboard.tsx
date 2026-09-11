import { Crosshair, Target, Trophy, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { EventSequenceChart } from '../components/charts/EventSequenceChart';
import { LeaderboardChart } from '../components/charts/LeaderboardChart';
import { PatternDistributionChart } from '../components/charts/PatternDistributionChart';
import { PatternScatterChart } from '../components/charts/PatternScatterChart';
import { PatternTable } from '../components/charts/PatternTable';
import { PatternWinRateChart } from '../components/charts/PatternWinRateChart';
import { FeaturedMatchHero } from '../components/dashboard/FeaturedMatchHero';
import { LeaderboardPanel } from '../components/dashboard/LeaderboardPanel';
import { LastMatchPanel } from '../components/match/LastMatchPanel';
import { GameOnboardingBanner } from '../components/onboarding/GameOnboardingBanner';
import { SessionDashboard } from '../components/sessions/SessionDashboard';
import { StatCard } from '../components/ui/StatCard';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';

function PageHeader({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return (
    <div className="mb-6">
      <p className="label-kicker">{kicker}</p>
      <h1 className="mt-2 font-display text-3xl font-black text-white">{title}</h1>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>
    </div>
  );
}

function OverviewSection() {
  const { user } = useAuth();
  const {
    selectedGame,
    hasLinkedAccount,
    linkedProviders,
    latestMatch,
    latestMatchLoading,
    polling,
    analyzing,
    refetchLatestMatch,
    leaderboard,
    stats,
  } = useDashboard();

  return (
    <div className="space-y-6 pb-16">
      {selectedGame && user ? (
        <GameOnboardingBanner
          game={selectedGame}
          linkedProviders={linkedProviders}
          hasGameAccount={hasLinkedAccount}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
        <FeaturedMatchHero
          game={selectedGame}
          match={latestMatch}
          loading={latestMatchLoading}
          polling={polling}
          analyzing={analyzing}
          hasLinkedAccount={hasLinkedAccount}
          onRefresh={refetchLatestMatch}
        />
        <LeaderboardPanel entries={leaderboard} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tactical Patterns"
          value={String(stats.patternCount)}
          numericValue={stats.patternCount}
          subtext="Detected by Markov engine"
          icon={<Target className="h-5 w-5" />}
          accent="emerald"
          delay={0.05}
        />
        <StatCard
          label="Avg Win Rate"
          value={`${(stats.avgWinRate * 100).toFixed(1)}%`}
          numericValue={stats.avgWinRate * 100}
          decimals={1}
          suffix="%"
          subtext={stats.topPattern ? `Best: ${stats.topPattern.patternName || stats.topPattern.patternSlug}` : 'No patterns yet'}
          icon={<Crosshair className="h-5 w-5" />}
          accent="cyan"
          delay={0.1}
        />
        <StatCard
          label="Total Samples"
          value={stats.totalSamples.toLocaleString()}
          numericValue={stats.totalSamples}
          subtext="Pattern occurrences analyzed"
          icon={<Users className="h-5 w-5" />}
          accent="violet"
          delay={0.15}
        />
        <StatCard
          label="Your Rank"
          value={stats.userRank !== null ? `#${stats.userRank}` : '—'}
          numericValue={stats.userRank ?? undefined}
          prefix={stats.userRank !== null ? '#' : ''}
          subtext={
            stats.userRank !== null
              ? 'Among scored players'
              : hasLinkedAccount
                ? 'Play matches to appear'
                : 'Link a game account'
          }
          icon={<Trophy className="h-5 w-5" />}
          accent="amber"
          delay={0.2}
        />
      </div>
    </div>
  );
}

function MatchSection() {
  const navigate = useNavigate();
  const {
    latestMatch,
    latestMatchLoading,
    latestMatchError,
    analyzing,
    polling,
    hasLinkedAccount,
    refetchLatestMatch,
    patterns,
    setHighlightedSlug,
    setSelectedPattern,
  } = useDashboard();

  return (
    <div className="pb-16">
      <PageHeader
        kicker="Live feed"
        title="Last match"
        description="Round-by-round pattern detections from your latest competitive sample."
      />
      <LastMatchPanel
        match={latestMatch}
        loading={latestMatchLoading}
        error={latestMatchError}
        analyzing={analyzing}
        polling={polling}
        hasLinkedAccount={hasLinkedAccount}
        onRefresh={refetchLatestMatch}
        onPatternSlugClick={(slug) => {
          setHighlightedSlug(slug);
          const pattern = patterns.find((item) => item.patternSlug === slug);
          if (pattern) {
            setSelectedPattern(pattern);
            navigate('/dashboard/analysis');
          }
        }}
      />
    </div>
  );
}

function PatternsSection() {
  const { patterns, searchQuery } = useDashboard();
  const filtered = patterns.filter((pattern) => {
    const haystack = `${pattern.patternName} ${pattern.patternSlug} ${pattern.description}`.toLowerCase();
    return haystack.includes(searchQuery.trim().toLowerCase());
  });

  return (
    <div className="pb-16">
      <PageHeader
        kicker="Telemetry"
        title="Tactical patterns"
        description="Win rates, volume, and frequency for the selected title."
      />
      <div className="grid gap-6 lg:grid-cols-2">
      <PatternWinRateChart patterns={filtered} />
      <PatternScatterChart patterns={filtered} />
      <div className="lg:col-span-2">
        <PatternDistributionChart patterns={filtered} />
      </div>
      </div>
    </div>
  );
}

function AnalysisSection() {
  const {
    patterns,
    selectedPattern,
    setSelectedPattern,
    highlightedSlug,
    searchQuery,
  } = useDashboard();
  const filtered = patterns.filter((pattern) => {
    const haystack = `${pattern.patternName} ${pattern.patternSlug} ${pattern.description}`.toLowerCase();
    return haystack.includes(searchQuery.trim().toLowerCase());
  });

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        kicker="Deep dive"
        title="Pattern analysis"
        description="Inspect Markov event chains and select a row to visualize the sequence."
      />
      <EventSequenceChart pattern={selectedPattern} />
      <PatternTable
        patterns={filtered}
        selectedId={selectedPattern?.id ?? null}
        highlightedSlug={highlightedSlug}
        onSelect={setSelectedPattern}
      />
    </div>
  );
}

export function Dashboard() {
  const { section } = useParams();
  const {
    gamesError,
    patternsError,
    leaderboardError,
    latestMatchError,
    insightsReady,
    dismissInsightsReady,
    selectedGameId,
    hasLinkedAccount,
    leaderboard,
  } = useDashboard();

  const hasError = gamesError || patternsError || leaderboardError || latestMatchError;

  return (
    <>
      {insightsReady ? (
        <Toast message="Your latest match analysis is ready to review." onDismiss={dismissInsightsReady} />
      ) : null}

      {hasError ? (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <p className="font-medium">Failed to load command center data</p>
          <p className="mt-1 text-red-200/80">
            Start the full stack: <code className="font-mono text-xs">docker compose up -d</code>
          </p>
        </div>
      ) : null}

      {section === 'match' ? <MatchSection /> : null}
      {section === 'activity' ? (
        <div className="pb-16">
          <PageHeader
            kicker="Sessions"
            title="Play activity"
            description="Heatmap, streaks, and inferred game sessions for the selected title."
          />
          <SessionDashboard gameId={selectedGameId} hasLinkedAccount={hasLinkedAccount} />
        </div>
      ) : null}
      {section === 'patterns' ? <PatternsSection /> : null}
      {section === 'rankings' ? (
        <div className="pb-16">
          <PageHeader
            kicker="Ladder"
            title="Rankings"
            description="XGBoost-scored leaderboard with your row highlighted."
          />
          <LeaderboardChart entries={leaderboard} />
        </div>
      ) : null}
      {section === 'analysis' ? <AnalysisSection /> : null}
      {!section || !['match', 'activity', 'patterns', 'rankings', 'analysis'].includes(section) ? (
        <OverviewSection />
      ) : null}
    </>
  );
}
