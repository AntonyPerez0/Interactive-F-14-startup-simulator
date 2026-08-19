# Credits and attribution

This is an unofficial, non-commercial community tool. It is not affiliated with,
endorsed by, or connected to any of the parties below.

## Cockpit imagery

Screenshots of the F-14B cockpit are from **DCS World**, developed and published
by **Eagle Dynamics SA**. The F-14 module is by **Heatblur Simulations**. All
rights in that artwork remain theirs.

They are used here for teaching switch positions, in the same spirit as the
tutorials and guides the community has always produced. If either party would
rather they were not, contact the site owner and they will be removed and
replaced with original diagrams — the trainer stores hotspots as coordinates, so
the artwork can be swapped without rewriting anything.

### F/A-18C cockpit views

The four Hornet views are cut from a single F/A-18C cockpit layout drawing
(`FA18C_1.0.png`) by `tools/compose-fa18c.py`, which also generates the hotspot
coordinates in `src/aircraft/fa18c/controls.js` from the same transform.

**The origin of that drawing is not established.** It carries no signature,
watermark or copyright notice — which is not the same as being free to publish;
an unmarked file is more often one whose notice was cropped than one that was
released. Before relying on it:

1. find where `FA18C_1.0.png` came from and what licence it carried;
2. credit the author here once you know;
3. if that cannot be established, replace it.

Replacing it is cheap by design. The trainer stores hotspots as coordinates, so
a new drawing means re-cutting the views with `tools/compose-fa18c.py` and
regenerating — no procedure, system or test changes.

## Procedures

Procedures follow **Chuck's DCS F-14B Guide**, with corrections from serving and
former aircrew who reviewed the trainer directly.

The F/A-18C procedures follow **Chuck's DCS F/A-18C Guide** — Part 4 (start-up),
Part 5 (takeoff, shore and carrier), Part 6 (landing and CASE I recovery) and
Parts 9-11 (sensors, weapons, countermeasures). The Hornet shutdown checklist is
not in the guide: it is the start-up reversed in the order the systems tolerate,
and the file says so at the top.

## Review

Corrections and flight-test feedback from members of the **Virtual Weapons
Academy**, whose insignia appears on the aircraft screen.

The author flies with the squadron but is not affiliated with it, and this site
is not theirs. They reviewed the procedures; they did not build this and are not
answerable for it. Their Discord is a good place to learn DCS World.

Where the guide and the reviewers disagreed, the reviewers won, and the reason is
written into the step. Where neither covered something — the shutdown procedure,
for instance — the file says so at the top.

## Trademarks

DCS World and Digital Combat Simulator are trademarks of Eagle Dynamics. Aircraft
names and designations are the property of their respective owners. Nothing here
claims any association with them.

## This code

The trainer itself — the simulation, the checklist engine, the interface — is
original work. Reuse it, learn from it, build another aircraft into it.
