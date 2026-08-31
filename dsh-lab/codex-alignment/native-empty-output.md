# Intermittent native command-item output loss

Observed during real error-fidelity acceptance on native executable
`0.151.0-alpha.7.2`, official DSH `0.1.0-rc.8`, immutable reference
`b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.

The controlled command prints `EXPECTED_PROBE_FAILURE` and exits 17. In one
DSH native-mode run, the model-visible `exec` result contained exit code 17 and
the complete marker, but the persisted native `CommandExecution` item had empty
stdout, stderr, aggregated output and formatted output. Its exit code remained
17. DSH persisted that command as an error with exit code 17 and no output text.
The model's final answer correctly reported the marker from its tool result.

This is not an approval rejection or an HTTP/network failure. The discrepancy
already exists between two representations saved by the native runtime; the
available evidence does not identify the internal native function responsible.
It also does not prove that Desktop's presentation would repair the same event.
Retain this failed acceptance case even if later repetitions pass.

The integration can join intermediate code-mode output using an explicit
process/session ID. The completed tool result in this case has only a chunk ID,
not that process ID. Blindly copying a batched result or the model's final prose
onto a command could attach another command's output. No such heuristic repair
was added. A fix needs a reliable native association or corrected native item
output. Raw evidence stays outside Git.
