---
name: triage
description: Evidence-first root-cause triage for a failing test. Use for EVERY red test before proposing any fix, test-data change, or setup change - on a test-run failure, a scheduled-run failure, a timeout, a wrong-message assert, or any impulse to say "needs new test data". Takes a test name (e.g. CartTests.Checkout_EmptyCart_ShowsError) and optionally the folder of the run to read.
---

# /triage <Test> - bucket a failure on evidence, not vibes

Diagnosis-by-plausibility is the failure this ritual exists to stop:
the obvious-looking cause is often wrong.

- Artifacts beat code reads.
- A probe beats intuition.
- The burden of proof is on the exotic explanation.

## Settings first

- Read `## Shared` and `## Triage` in `.claude/skill-settings.md` at the
  repo root (`git rev-parse --show-toplevel`).
- A value there overrides the default named below.
- A rule there is followed as if written here.
- No file, or no section: use the defaults below. Say ONCE, in one line,
  that `.claude/skill-settings.md` can tune this skill and the template
  is in the plugin's `templates/triage.md`. Never stop because the file
  is missing.
- Read every doc the `policy docs` setting names before step 1. They
  hold the repo's full triage order; this skill is the short form.

**No tool configured means skip, not guess.** When a step needs a
setting that is empty (`triage command`, `report viewer`,
`setup audit command`, `verify command`), skip that part, say so in one
line, and work from whatever test output the user points at.

## The ritual, in order - no skipping

1. **Artifacts FIRST, newest run only.**
   - Find the run's output in `artifact folder`. Default: whatever the
     user points at; ask if they pointed at nothing.
   - Read the files in `artifact order`. Default: the screenshot (if
     any), then the visible page text or test output, then the final
     URL or location, then console or log output.
   - The screenshot answers "where did it actually end up" in one
     glance.
   - Console errors are usually symptoms (a timeout tearing down the
     page mid-load), not causes.
   - An older run's artifacts describe a prior run and WILL mislead.
     Sort by date and read the newest.

2. **The opening command.**
   - Run `triage command` with the test name, if one is set. Default:
     none; skip and say so.

   **When the screenshot does not explain it, open the report viewer.**
   - The screenshot is the SYMPTOM. The cause is usually two steps
     upstream, and those steps often exist only inside a step-by-step
     trace or recording.
   - Use `report viewer` if one is set. Default: none; read any trace
     file the run left by hand, or skip and say so.
   - Follow every `report viewer` rule in the settings (how to start
     it, how to probe it, whether to leave it running).
   - The viewer is READ-ONLY. **Do not build a channel for verdicts
     through it.**

   **A human's read reaches you in chat.**
   - It still outranks your own first guess when they saw more than you
     (a step-by-step recording against your final screenshot).
   - It is a strong prior, not a gag order: contradict it with
     artifacts if the artifacts disagree.

3. **PROBE, but only if the artifacts left it AMBIGUOUS.**
   - The full procedure and its gate may live in a `policy docs` doc;
     follow it if so.
   - The question the probe answers is the one that eats hours:
     **which SIDE is wrong, the test or the product?**
   - Hand-write the smallest test doing the SAME user action on the
     SAME surface, run it ONCE, and read the partition:

   | Probe result | Proves | Go to |
   |---|---|---|
   | Passes | Product and setup fine; the failing test's path is wrong | step 4 as **R1** - the probe IS the positive evidence |
   | Fails the same way | The test's path is innocent | step 4 as **R2** |
   | Fails differently | Your reproduction is wrong | back to step 1 |

   - **Never carry it to green** - the job ends at the partition.
   - **One file, one action, one shot.** If it will not write in one
     pass, that failure IS the finding: say so and go to the setup
     check (step 5).

   > **Anti-circularity.** Write the probe from the product source, not
   > from the failing test. A probe copied from the failing test agrees
   > with it by construction and proves nothing.

   **Hard rule: no "needs new test data" claim on an ambiguous artifact
   until a probe has partitioned it.**

4. **Bucket it - R1-R4 with the burden rules.**
   The buckets (renamed or extended by `buckets` in the settings):

   | Bucket | Meaning |
   |---|---|
   | R1 | The test does the wrong thing |
   | R2 | Test data or setup gap |
   | R3 | Harness or environment |
   | R4 | Product bug |

   - R2 is the DEFAULT first suspect.
   - R1 only with positive evidence: artifact + product source showing
     the test demands what the product never renders, **or a step-3
     probe that PASSED**.

   > **The "expected ERROR, got SUCCESS" trap - do not bucket this R2 on
   > sight.** It reads as an obvious setup gap (the rejecting
   > precondition was never established, so the action succeeded).
   > First check: **did the test inject the failure?** An error-path
   > test that relies on a fake, mock or injected error must actually
   > register it, on a method the action really calls. No injection
   > means the real action runs, and the real action succeeds. That is
   > the test, not the setup. The settings may name the repo's
   > injection call (`failure injection`).

   - R3 when the failure mode is harness-shaped.
   - R4 is LAST RESORT. It requires:
     - reading the surface's source end-to-end;
     - walking the real user path;
     - reproducibility by a human clicking.
   - Then it gets LOGGED where `product bug log` says, never silently
     fixed. Default: report it in chat and change no product code.

5. **An R2 verdict resolves in the setup, checked against its
   contract.**
   - Where test data and setup are declared: `setup location`. Default:
     the test's own fixtures, setup methods and any data files they
     load.
   - Before proposing any state fix:
     - Which setup or fixture does the test use?
     - Does that setup already declare the needed state? Read it, plus
       anything it builds on.
     - Is the gate even on the test's walked path? Read the product
       source around the element or call the test waits for.
   - A fault-only state goes in its own isolated setup, never in setup
     other tests share.
   - Run `setup audit command` afterward, if one is set; it must be
     clean. Default: none; skip and say so.
   - If `known fixes doc` is set, read it before investigating and
     write back every new "what data satisfies X" finding.

6. **Check the demand before satisfying it.**
   - Before adding data: does the element or control the test waits
     for actually sit on this action's path?
   - A test that waits for the wrong control is an R1. Adding data to
     satisfy it "honestly" bakes the bug in.
   - Same for hazards: an error-path test that cannot trigger its error
     is a test bug, not a data gap.

7. **Forbidden resolutions.**
   - Skip, suppress, or "live with it" are never verdicts.
   - Typing one is the tell you are dodging owned work.

## Output format

```
TEST: <Test>   BUCKET: R1|R2|R3|R4
EVIDENCE: <artifact paths + file:line for every claim>
CAUSE: <one sentence, mechanism not symptom>
FIX: <what + where>   VERIFIED-DONE: <rerun criterion>
```

- A fix is DONE only when a rerun proves it. Predictions are not
  results.
- The rerun is `verify command`, run under its rules. Default: none
  configured; name the rerun of just the failing test and ask the user
  before running it.
