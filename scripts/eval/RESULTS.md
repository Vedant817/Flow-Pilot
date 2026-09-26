# Local email classification verification (synthetic only)

The 80-email dataset in `dataset.json` has 32 training examples (IDs 01–08 in each class) and 48 held-out examples (09–20). Examples were authored for this project, not sampled from production; figures are only comparative local evidence. The production pipeline uses the fine-tuned MiniLM **q8** encoder and a logistic-regression head with subject + cleaned body. Its 48-example held-out score is **36/48 (75%)**; its confidence is not calibrated on real mail.

`laya_variants.py` evaluated the local `convaiinnovations/laya` English checkpoint on the same split, running inference on all 80 messages. The original prompt reproduced the earlier baseline; two alternatives explicitly distinguished purchase commitment from inquiries and edits, with and without quoted-text cleanup:

| Laya question/input | Train (32) | Held-out (48) |
| --- | ---: | ---: |
| Original question, subject + raw body | 22 (69%) | 34 (71%) |
| Explicit intent criteria, subject + raw body | 14 (44%) | 20 (42%) |
| Explicit criteria, subject + cleaned body | 14 (44%) | 20 (42%) |
| Shipped SetFit q8, subject + cleaned body | — | **36 (75%)** |

The tested prompt changes do not justify replacing the in-process model with a Python service. Laya's package warned during the run that some checkpoint temperature values were clamped, so its confidence is not a sound automation threshold here. The three result files are in `preds/laya_*.json`.

Classification accuracy is not the same as order-write safety. The webhook previously used a partial parser's default date/time and product list to overwrite an entire pending order, and marked classified but unparseable orders processed without surfacing them. It now queues all order amendments and incomplete/ambiguous new orders in the existing `Error` collection with a Gmail message ID for review; an explicit new-purchase request and usable product lines are required before creating an order. This favors avoiding irreversible incorrect writes while a validated order-change parser is not available.

Do not retrain on held-out errors and then present scores on those same 48 emails as an unbiased improvement. Test new candidates on separately authored or real labeled mail. Run `npm test` for the real encoder smoke test and `npx tsx scripts/eval/bakeoff.ts` to regenerate classifier predictions.
