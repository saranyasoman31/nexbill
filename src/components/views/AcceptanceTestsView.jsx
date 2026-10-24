// AcceptanceTestsView: Interactive Visual Runner for all 14 Core Acceptance Tests (Section 20)
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AcceptanceTestsService } from '../../services/acceptanceTestsService';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

const TEST_DEFINITIONS = [
  { id: 1, title: 'Purchase of 10 units increases correct warehouse by exactly 10', section: 'Sec 20.1' },
  { id: 2, title: 'Sale of 3 units decreases stock by exactly 3', section: 'Sec 20.2' },
  { id: 3, title: 'Sale exceeding available stock blocked by default with no partial posting', section: 'Sec 20.3' },
  { id: 4, title: 'Repeating same sale request does not duplicate invoice or stock-out (Idempotency)', section: 'Sec 20.4' },
  { id: 5, title: 'Return cannot exceed original eligible quantity after previous returns', section: 'Sec 20.5' },
  { id: 6, title: 'Transfer dispatch, receipt, in-transit quantity, and variance reconcile', section: 'Sec 20.6' },
  { id: 7, title: 'Concurrent sales cannot both consume same final unit (Row lock mutex)', section: 'Sec 20.7' },
  { id: 8, title: 'Coupon single-use policy prevents double consumption', section: 'Sec 20.8' },
  { id: 9, title: 'Price change does not modify historical invoice rates', section: 'Sec 20.9' },
  { id: 10, title: 'Store-level isolation prevents cross-store unauthorized warehouse posting', section: 'Sec 20.10' },
  { id: 11, title: 'Posting to a closed register period is strictly blocked', section: 'Sec 20.11' },
  { id: 12, title: 'Failure during posting rolls back all related stock and financial records atomically', section: 'Sec 20.12' },
  { id: 13, title: 'Manual stock adjustment above material threshold requires supervisor approval', section: 'Sec 20.13' },
  { id: 14, title: 'Retrying an external Tally export does not duplicate accounting vouchers', section: 'Sec 20.14' },
];

export default function AcceptanceTestsView() {
  const { notify, triggerRefresh } = useApp();

  const [testResults, setTestResults] = useState({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningTestId, setRunningTestId] = useState(null);
  const [expandedTestId, setExpandedTestId] = useState(null);

  const runSingleTest = async (testId) => {
    setRunningTestId(testId);
    try {
      const res = await AcceptanceTestsService.runTest(testId);
      setTestResults(prev => ({ ...prev, [testId]: res }));
      setExpandedTestId(testId);
      triggerRefresh();
      if (res.passed) {
        notify('success', `Test #${testId} passed successfully.`, 'Assertion Verified');
      } else {
        notify('error', `Test #${testId} failed assertion.`, 'Test Failed');
      }
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [testId]: {
          testId,
          title: `Test #${testId}`,
          passed: false,
          logs: [`Execution failed: ${err.message}`],
        }
      }));
    } finally {
      setRunningTestId(null);
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    setTestResults({});
    try {
      await AcceptanceTestsService.runAllTests((idx, res) => {
        setTestResults(prev => ({ ...prev, [idx]: res }));
      });
      triggerRefresh();
      notify('success', 'All 14 Core Acceptance Tests executed successfully!', 'Test Suite Complete');
    } catch (err) {
      notify('error', err.message, 'Suite Error');
    } finally {
      setIsRunningAll(false);
    }
  };

  const passedCount = Object.values(testResults).filter(t => t.passed).length;
  const executedCount = Object.keys(testResults).length;

  const exportData = TEST_DEFINITIONS.map(def => {
    const result = testResults[def.id];
    return {
      testId: def.id,
      section: def.section,
      title: def.title,
      status: result ? (result.passed ? 'PASSED' : 'FAILED') : 'NOT RUN',
      details: result ? (result.logs ? result.logs.join('; ') : '') : 'Pending execution'
    };
  });

  const exportColumns = [
    { header: 'Test #', key: 'testId' },
    { header: 'Section', key: 'section' },
    { header: 'Test Specification & Scenario', key: 'title' },
    { header: 'Status', key: 'status' },
    { header: 'Execution Assertion Logs', key: 'details' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-purple-950/50 border border-indigo-500/40 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <FlaskConical className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Section 20: Core Acceptance Test Suite</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                14 Specification Tests
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Direct verification of NexBill ERP transaction rules: stock integrity, idempotency, row locks, GST split, and rollback controls.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {executedCount > 0 && (
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Test Score</div>
              <div className="text-xl font-black font-mono text-emerald-400">
                {passedCount} / {executedCount} Passed
              </div>
            </div>
          )}

          <ExportButtons
            data={exportData}
            columns={exportColumns}
            filename="Section_20_Acceptance_Tests_Report"
            title="NexBill ERP - Section 20 Core Acceptance Test Suite"
            subtitle={`Executed: ${executedCount}/14 | Passed: ${passedCount} | Date: ${new Date().toLocaleDateString()}`}
            size="small"
          />

          <button
            onClick={runAllTests}
            disabled={isRunningAll}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30 transition"
          >
            <Play className="w-4 h-4" />
            {isRunningAll ? 'Executing Suite...' : 'Run All 14 Acceptance Tests'}
          </button>
        </div>
      </div>

      {/* Test Cases List */}
      <div className="space-y-2">
        {TEST_DEFINITIONS.map(def => {
          const result = testResults[def.id];
          const isRunning = runningTestId === def.id || (isRunningAll && !result);
          const isExpanded = expandedTestId === def.id;

          return (
            <div
              key={def.id}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md transition hover:border-slate-700"
            >
              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-indigo-300 border border-slate-700 shrink-0 font-mono">
                    {def.section}
                  </span>

                  <span className="font-semibold text-slate-200 text-xs flex-1">
                    {def.title}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Status Indicator */}
                  {isRunning ? (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Running...</span>
                    </div>
                  ) : result ? (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                      result.passed
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                    }`}>
                      {result.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      <span>{result.passed ? 'PASSED' : 'FAILED'}</span>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-xs">Not Run</span>
                  )}

                  {/* Run Individual Button */}
                  <button
                    onClick={() => runSingleTest(def.id)}
                    disabled={isRunningAll || isRunning}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
                    title="Run this test only"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>

                  {/* Toggle Logs Accordion */}
                  {result && (
                    <button
                      onClick={() => setExpandedTestId(isExpanded ? null : def.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Toggle detailed audit logs"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Detailed Test Logs */}
              {isExpanded && result && (
                <div className="bg-slate-950 border-t border-slate-800 p-4 space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Step-by-Step Execution & Assertion Logs:
                  </div>
                  <pre className="font-mono text-xs text-emerald-400 space-y-1 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 whitespace-pre-wrap">
                    {result.logs.map((log, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-slate-600 select-none">[{idx + 1}]</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
