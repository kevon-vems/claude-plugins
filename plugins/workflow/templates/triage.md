## Triage

Read by /triage. Every line is optional. Plain bullets under the keys are rules, followed as if written in the skill.

- policy docs: none
  - Docs to read before step 1; they hold the repo's full triage order. One path per line.
- artifact folder: none
  - Where a run's failure output lands, and how its dated folders are named. Default: whatever the user points at.
- artifact order: screenshot, visible text or test output, final URL, console or log
  - The files to read for one failure, in order, with any naming pattern.
- triage command: none
  - Command that prints one test's artifacts. `<Test>` stands for the test name. Default: none; the step is skipped.
- report viewer: none
  - Command and URL for a step-by-step trace viewer, plus its rules (how to probe it, whether to leave it running). Default: none; read trace files by hand.
- buckets: R1 test bug, R2 data or setup gap, R3 harness or environment, R4 product bug
  - Bucket names and what each means here. The burden rules stay: R2 first, R1 needs positive evidence, R4 last.
- failure injection: none
  - The call an error-path test uses to force a failure (fake, mock). Checked before bucketing "expected error, got success" as R2.
- setup location: the test's own fixtures and setup
  - Where test data and setup are declared and built, and where each kind of fix lands.
- setup audit command: none
  - Command that must be clean after a setup fix. Default: none; skipped.
- known fixes doc: none
  - Doc of proven "what data satisfies X" answers. Read first; write back every new finding.
- product bug log: chat
  - Where an R4 is logged. The skill never fixes product code silently. Default: report in chat.
- verify command: none
  - How a fix is proven done, and when it may run. Default: name the rerun and ask before running it.
