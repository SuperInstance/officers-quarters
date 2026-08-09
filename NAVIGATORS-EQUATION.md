# The Navigator's Equation — Time, Space, and the Path of Least Resistance

*From Casey's description of fishing operations on the F/V EILEEN, Aug 9 2026*

---

## The Sounder

The transducer sends a pulse. The pulse travels at a known speed through water. It hits a fish — or the bottom — and returns. The time of flight gives distance.

But on the scope, time of flight becomes **vertical space**. The oscilloscope draws a vertical line where the bottom is, dots where fish are. And as the boat moves forward, those vertical lines stack sideways — **time becomes horizontal space** — and the scope draws a picture of the water column beneath the track.

You are reading a two-dimensional image that is actually a one-dimensional measurement unfolded over time. The waveform of time becomes an image of space.

This is the same thing the fish identification simulation does: a stream of raw measurements (sonar returns, camera frames) unfolds into a spatial picture over time. The agent doesn't need to understand each return individually — they need to see the picture that forms from the sequence.

## The Trackline

The chart shows where the boat has been. The trackline is a line on the chart, but it's also a **timeline** — because at 1.5 knots, distance and time are the same thing.

A 20-minute soak = half a mile of trackline. The good pull started within the last half mile. You can see it on the chart — not as a number, but as a **visual proportion**. The distance from the last mark to where you are now is the answer to "how long has this gear been fishing?"

The chart is a clock. The trackline is a timeline. Space and time are the same substrate.

## The 5-Minute Predictor

The chart shows where you'll be in 5 minutes if you hold course. You can extrapolate 3-4x that distance — 15-20 minutes — because a straight run for gear-pulling takes at least 10 minutes without a tangle.

The predictor isn't a calculation. It's a **visual habit**. You look at the chart and see where you'll be the way you see where a thrown ball will land. The path is already drawn in the proportion between the predictor line and the features on the chart.

This is the deadband in action. The 5-minute predictor is a tile — a reflexive visual estimation. The 15-20 minute extrapolation is an edge case — slightly beyond the tile's deadband, but close enough that the same habit extends. You don't recalculate. You look and you know.

## Boat-Lengths as Universal Unit

The boat is 50.6 feet long. At 1.5 knots, you travel 2 boat-lengths per minute.

Other boats: the 32-footers move at 2-3 boat-lengths per minute (theirs are shorter). You can see them, estimate distance in boat-lengths, and immediately know the ETA — not in minutes, but in **proportion**.

"Three of my boat-lengths away" = about 90 seconds.
"That seiner is 10 boat-lengths off my port bow and moving at 2 boat-lengths per minute" = 5 minutes to closest approach.

This is an internal equation. Not lat/long, not SOG/COG, not vector math. Visual proportion. The eye does the calculation without the numbers ever surfacing.

This is what the tile system should become. Not a dashboard of metrics. A **visual field** where the agent sees the situation the way a captain sees the chart — time and space collapsed into proportion, and the right action obvious from the geometry.

## The Radar Pulse

The radar was solid-state — capable of constant feed. Casey left it on simulated rotational update. Why?

Because the **pulse** is a tool. A steady sweep that updates the position of other vessels. By watching a dot move through 2-3 cycles of pixel change, you extract direction and speed — not from the numbers, but from the **rate of change of deltas**.

The entire vector array of the two-dimensional plane can be extrapolated from the rate of change of position over a few radar pulses. Not by analytic calculation — by **operational proof**. The geometric properties don't change. Two bearings on a target establish a line; three establish a trend. You don't need to compute — you need to observe.

This is the pulse of the deadband system. Not constant computation. Periodic observation. A few samples, and the pattern is clear. The tile doesn't need real-time data — it needs enough pulses to confirm the reflex.

## The Path of Least Resistance

> "You don't have to think ahead, you only need to be able to extrapolate a highly abstracted viewpoint that makes the path of least resistance and the motion you want to carve one and the same and position your substrate and tools to match."

This is the thesis. Not planning. Not calculating. **Positioning.**

The captain doesn't plan the route. The captain positions the boat so that the route finds itself. The current, the wind, the tide, the gear, the fish — all are forces. The captain doesn't fight them. The captain angles the substrate (the boat) so that the forces combine into the desired motion.

This is the poker player's skill: not planning the hand, but positioning the stack so the right play is the obvious play. This is the coder's skill: not planning the architecture, but positioning the code so the right structure emerges. This is the agent's skill: not planning the task, but positioning the tiles so the reflex layer handles the routine and the cortex is free for the novel.

The path of least resistance and the motion you want to carve are one and the same — when you're positioned correctly. The work is in the positioning. The result is in the letting-go.

---

## What This Means for the Fleet

1. **The Navigator's Terminal** should not be a dashboard of numbers. It should be a visual field — a chart, a sounder, a radar — where the agent sees proportions, not metrics. Time and space collapsed into visual relationships.

2. **The Tile System** should work like the 5-minute predictor: a visual habit that extends naturally. The tile handles the reflexive case. The extrapolation handles the edge case. Neither requires calculation — only observation.

3. **Agent Coordination** should work like boats in tight quarters: each agent aware of the others through visual proportion (who's close, who's moving fast, who's on a collision course) — not through message passing or status reports.

4. **The Pulse** (periodic observation rather than constant streaming) is the right model for agent self-monitoring. Sample 2-3 cycles. Extract the trend. Don't waste attention on constant computation.

5. **The Path of Least Resistance** is the design principle for the whole system. Don't build agents that fight the current. Build agents that position themselves so the current carries them where they want to go. The work is in the positioning. The rest is letting the substrate do what it does.
