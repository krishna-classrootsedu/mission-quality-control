"use client";

type RuleResult = {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  evidence?: string;
  slideNumbers?: number[];
};

type GatekeeperResult = {
  passed: boolean;
  ruleResults: RuleResult[];
};

export default function GatekeeperResults({ result }: { result: GatekeeperResult | null }) {
  if (!result) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Gatekeeper (7 Binary Rules)</h2>
        <p className="text-sm text-gray-400">Not yet checked</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500">Gatekeeper (7 Binary Rules)</h2>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
          result.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        }`}>
          {result.passed ? "PASSED" : "FAILED"}
        </span>
      </div>
      <div className="space-y-2">
        {result.ruleResults.map((rule) => (
          <div key={rule.ruleId} className="flex items-start gap-2">
            <span className={`mt-0.5 text-sm ${rule.passed ? "text-emerald-500" : "text-red-500"}`}>
              {rule.passed ? "✓" : "✗"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-700">{rule.ruleName}</div>
              {rule.evidence && (
                <div className="text-xs text-gray-400 mt-0.5">{rule.evidence}</div>
              )}
              {rule.slideNumbers && rule.slideNumbers.length > 0 && (
                <div className="text-xs text-gray-400">
                  Slides: {rule.slideNumbers.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
