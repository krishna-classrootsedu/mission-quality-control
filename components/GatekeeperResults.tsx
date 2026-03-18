"use client";

type RuleResult = { ruleId: string; ruleName: string; passed: boolean; evidence?: string; slideNumbers?: number[] };
type GatekeeperResult = { passed: boolean; ruleResults: RuleResult[] };

export default function GatekeeperResults({ result }: { result: GatekeeperResult | null }) {
  if (!result) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Gatekeeper Rules</h2>
        <p className="text-sm text-gray-300">Not yet checked</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Gatekeeper Rules</h2>
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
          result.passed ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
        }`}>
          {result.passed ? "PASSED" : "FAILED"}
        </span>
      </div>
      <div className="space-y-2.5">
        {result.ruleResults.map((rule) => (
          <div key={rule.ruleId} className="flex items-start gap-2.5">
            <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
              rule.passed ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"
            }`}>
              {rule.passed ? "\u2713" : "\u2717"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-700 font-medium">{rule.ruleName}</div>
              {rule.evidence && <div className="text-[11px] text-gray-400 mt-0.5">{rule.evidence}</div>}
              {rule.slideNumbers && rule.slideNumbers.length > 0 && (
                <div className="text-[11px] text-gray-300 font-mono">Slides: {rule.slideNumbers.join(", ")}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
