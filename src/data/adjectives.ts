export const ADJECTIVES = [
    {
        id: "bonus",
        lemma: "bonus",
        meaning: "good",
        // 1st/2nd decl adjective patterns (we only need nom/acc sg, m/f/n)
        forms: {
            nomSg: { m: "bonus", f: "bona", n: "bonum" },
            accSg: { m: "bonum", f: "bonam", n: "bonum" },
        },
    },
    {
        id: "magnus",
        lemma: "magnus",
        meaning: "big / great",
        forms: {
            nomSg: { m: "magnus", f: "magna", n: "magnum" },
            accSg: { m: "magnum", f: "magnam", n: "magnum" },
        },
    },
    {
        id: "parvus",
        lemma: "parvus",
        meaning: "small",
        forms: {
            nomSg: { m: "parvus", f: "parva", n: "parvum" },
            accSg: { m: "parvum", f: "parvam", n: "parvum" },
        },
    },
    {
        id: "celer",
        lemma: "celer",
        meaning: "fast",
        // We simplify: treat as 1st/2nd-like endings for drill (real 3rd decl adj later)
        forms: {
            nomSg: { m: "celer", f: "celeris", n: "celer" },
            accSg: { m: "celerem", f: "celerem", n: "celer" },
        },
        note: "Technically 3rd decl adjective - used lightly as a challenge word.",
    },
];
