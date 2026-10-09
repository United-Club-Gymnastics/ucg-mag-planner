"""Builds js/skills.js (the skill list behind the skill search) and js/vaults.js
(the vault picker) from:

  WG skills:  skills_verified.json from the FIG MAG CoP 2025-2028 extractor
              (Dropbox: Gymnastics/Reference/gym_skill_extract)
  UCG skills: every skill box in the UCG MAG Code of Points master
              (repo: C:/dev/ucg-code-of-points/MAG/UCG MAG CoP.svg),
              read with that repo's tools (needs Inkscape, as they do)

Run after the UCG CoP gets new skills (or a new WG CoP is extracted):
    python tools/build_skills.py
Paths can be overridden with --wg and --cop (the Code of Points repo folder).
Advanced (GymACT) vault values: GymACT raises some handspring vaults above their
WG value; those are in ADV_VAULT (from the MAG Routine Composition Planner sheet).
"""
import argparse
import json
import os
import re
import sys

DROPBOX = os.path.expanduser(r"~/Steinsharpe Dropbox/Nate Sharpe/Documents/Gymnastics")
WG_DEFAULT = os.path.join(DROPBOX, "Reference", "gym_skill_extract", "skills_verified.json")
COP_DEFAULT = r"C:\dev\ucg-code-of-points"
OUT = os.path.join(os.path.dirname(__file__), "..", "js", "skills.js")
VAULT_OUT = os.path.join(os.path.dirname(__file__), "..", "js", "vaults.js")

# Advanced (GymACT) values that differ from the WG value, by WG vault number.
ADV_VAULT = {107: 3.6, 108: 4.4, 109: 4.8, 113: 4.0, 114: 4.4, 115: 4.8, 116: 5.2, 117: 5.6, 118: 6.0,
             213: 2.8, 219: 3.8, 225: 5.2, 226: 5.6, 228: 5.6, 231: 5.6, 232: 6.0}
# Vaults with no salto (the only ones allowed at Developmental).
NON_FLIPPING = set(range(201, 207)) | set(range(301, 304)) | set(range(501, 504)) | set(range(513, 516))

APPS = ["FX", "PH", "SR", "PB", "HB"]
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4}
# Drawing labels inside some UCG boxes, not part of the skill name.
DROP = re.compile(r"^\((DSA|DSB|Circle in (cross|side) support)\)$|^(A|B|C|D|Ga)$")


def wg_skills(path):
    out = []
    for s in json.load(open(path, encoding="utf-8")):
        if s["apparatus"] not in APPS:
            continue
        out.append({
            "id": f"WG-{s['apparatus']}-{s['element_group']}-{s['number']}",  # FIG numbers restart in each EG
            "app": s["apparatus"].lower(),
            "name": " ".join(s["description"].split()),
            "eponym": s["eponym"] or "",
            "value": s["value"].split("=")[0],
            "eg": ROMAN.get(s["element_group"]),
            "src": "WG",
            "note": "",
        })
    return out


def ucg_skills(cop_dir):
    sys.path.insert(0, os.path.join(cop_dir, "tools"))
    from cop_skills import CoP, APPARATUS_PAGES, SVG
    from paths import MAG_SVG

    cop = CoP(MAG_SVG)
    out = []
    for app in APPS + ["VT"]:
        res, _ = cop.skills(app)
        for r in res:
            lines = []
            for el in cop.cells[r["at"]]["content"]:
                for t in el.iter(SVG + "text"):
                    style = (t.get("style") or "") + "".join(x.get("style") or "" for x in t.iter())
                    if "Greed" in style:  # value / EG lettering
                        continue
                    for line in [x for x in t if x.tag == SVG + "tspan"] or [t]:
                        s = " ".join("".join(line.itertext()).split())
                        if s:
                            lines.append(s)
            name, note, eponyms, in_note = [], [], [], False
            for s in lines:
                if DROP.match(s):
                    continue
                if s.startswith("Note:") or s.startswith("(same box"):
                    in_note = True
                m = re.fullmatch(r"\(([A-Z][A-Za-z.' -]+(?: \d)?)\)", s)  # (Batta), (Sharpe 2)
                if m and not s.startswith("(same box"):
                    eponyms.append(m.group(1))
                    in_note = False
                elif in_note:
                    note.append(s)
                else:
                    name.append(s)
            value = r["value"]
            out.append({
                # Ids are saved with routines, so they come from the name, not the box position.
                "id": f"UCG-{app}-" + re.sub(r"[^a-z0-9]+", "-", " ".join(name + eponyms).lower()).strip("-")[:60],
                "app": app.lower(),
                "name": " ".join(name),
                "eponym": " / ".join(eponyms),
                "value": "Sub-A" if value.upper().startswith("SUB") else value.upper(),
                "eg": ROMAN.get(r["eg"]),
                "src": "UCG",
                "note": " ".join(note).replace("Note: ", ""),
            })
    return out


def wg_vaults(path):
    out = []
    for s in json.load(open(path, encoding="utf-8")):
        if s["apparatus"] != "VT":
            continue
        n, v = s["number"], float(s["value"])
        out.append({
            "id": str(n),
            "name": " ".join(s["description"].split()),
            "eponym": s["eponym"] or "",
            "eg": s["element_group"],
            "value": v,
            "adv": ADV_VAULT.get(n, v),
            "flipping": n not in NON_FLIPPING,
            "src": "WG",
        })
    return out


def ucg_vaults(ucg):
    out = []
    for s in ucg:
        if s["app"] != "vt":
            continue
        v = float(s["value"])
        out.append({
            "id": s["id"],
            "name": s["name"],
            "eponym": s["eponym"],
            "eg": "",
            "value": v,
            "adv": v,
            "flipping": bool(re.search(r"(?i)flip|salto", s["name"])),
            "src": "UCG",
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wg", default=WG_DEFAULT)
    ap.add_argument("--cop", default=COP_DEFAULT)
    a = ap.parse_args()
    ucg = ucg_skills(a.cop)
    vaults = ucg_vaults(ucg) + wg_vaults(a.wg)
    with open(VAULT_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_skills.py: UCG MAG CoP vaults, then WG (FIG MAG CoP 2025-2028) vaults.\n")
        f.write("// value = D score for Developmental and Intermediate; adv = D score for Advanced (GymACT).\n")
        f.write("// flipping = false for vaults with no salto (Developmental only allows these).\n")
        rows = ",\n".join("  " + json.dumps(v, ensure_ascii=False) for v in vaults)
        f.write(f"export const VAULTS = [\n{rows}\n];\n")
    print(f"wrote {os.path.normpath(VAULT_OUT)}: {len(vaults)} vaults")
    skills = [s for s in ucg if s["app"] != "vt"] + wg_skills(a.wg)
    rows = ",\n".join("  " + json.dumps(s, ensure_ascii=False) for s in skills)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/build_skills.py: UCG MAG CoP skills, then WG (FIG MAG CoP 2025-2028) skills.\n")
        f.write("// eg: element group 1-4, or null (no EG bonus). value: A-J or Sub-A.\n")
        f.write(f"export const SKILLS = [\n{rows}\n];\n")
    counts = {}
    for s in skills:
        counts[s["src"]] = counts.get(s["src"], 0) + 1
    print(f"wrote {os.path.normpath(OUT)}: {counts}")


if __name__ == "__main__":
    main()
