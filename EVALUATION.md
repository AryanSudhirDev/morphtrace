# Evaluation status

ContextCheck v1 has a **unit-test suite, not a benchmark**. It makes no measured claim about false-positive rate, missed-issue rate, accuracy, recall, calibration, or generalization.

## What is tested now

- **Development fixtures:** 3 paired, expected-category examples used while building the deterministic patterns.
- **Held-out fixtures:** 2 expected-category examples kept in a separate folder from the development fixtures.
- **Additional focused assertions:** 8 checks for exceptions, supersession, role boundaries, plain-text uncertainty, ambiguous references, abstention, unsafe markup, and shortening.

The current test denominator is **13 assertions**, each covering one expected behavior. This is not a representative conversation sample and must not be converted into a performance percentage.

## Future reviewer evaluation

Before making performance claims, collect a labeled evaluation set that is separate from development examples. Report separately:

- true issues found;
- false positives, with denominator of non-issues;
- missed issues, with denominator of labeled issues;
- abstentions, with denominator of all eligible cases;
- unsupported cases excluded from scoring, with a stated rule.

Retain message IDs, source passages, reviewer disagreement, and the supported-pattern version for every label. Do not call a model self-reported confidence calibrated probability.
