/**
 * Just Orange — Free local matching engine
 * Zero API cost. Picks ONE perfect recipe from the knowledge base.
 */
(function (global) {
  "use strict";

  const RECIPES = () => global.JUST_ORANGE_RECIPES || [];
  const ALIASES = () => global.JUST_ORANGE_ALIASES || {};

  function normalizeToken(raw) {
    let t = String(raw || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, " ");
    if (!t) return "";
    const map = ALIASES();
    if (map[t]) return map[t];
    // strip simple plurals
    if (t.endsWith("oes")) t = t.slice(0, -2); // tomatoes -> tomato
    else if (t.endsWith("ies")) t = t.slice(0, -3) + "y";
    else if (t.endsWith("es") && t.length > 4) t = t.slice(0, -2);
    else if (t.endsWith("s") && t.length > 3) t = t.slice(0, -1);
    return map[t] || t;
  }

  function parseList(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input.map(normalizeToken).filter(Boolean);
    return String(input)
      .split(/[,;/|]+/)
      .map(normalizeToken)
      .filter(Boolean);
  }

  function unique(arr) {
    return [...new Set(arr)];
  }

  function tasteMatch(recipeTastes, want) {
    if (!want || want === "any" || want === "mild/neutral") {
      // mild/neutral prefers mild
      if (want === "mild/neutral") {
        return recipeTastes.includes("mild") ? 1.2 : 0.7;
      }
      return 1;
    }
    const w = want.toLowerCase();
    const aliases = {
      "savory/umami": ["savory", "umami"],
      "fresh/herby": ["fresh", "herby"],
      spicy: ["spicy"],
      sweet: ["sweet"],
      sour: ["sour"],
      umami: ["umami", "savory"],
      savory: ["savory", "umami"],
      fresh: ["fresh", "herby"],
      herby: ["herby", "fresh"],
      mild: ["mild"],
      comforting: ["savory", "mild", "umami"],
    };
    const keys = aliases[w] || [w];
    let hit = 0;
    for (const k of keys) {
      if (recipeTastes.includes(k)) hit++;
    }
    if (hit === 0) return 0.15;
    return 1 + hit * 0.35;
  }

  function hasAllergenConflict(recipe, allergens) {
    if (!allergens.length) return false;
    const rAll = (recipe.allergens || []).map((a) => a.toLowerCase());
    const rIng = [...(recipe.ingredients || []), ...(recipe.optional || [])].map(
      (a) => a.toLowerCase()
    );
    for (const a of allergens) {
      if (rAll.includes(a) || rIng.includes(a)) return true;
      // peanut ↔ peanut butter
      if (a === "peanut" && (rAll.includes("peanut") || rIng.some((i) => i.includes("peanut"))))
        return true;
      if (a === "nut" && rAll.some((x) => x.includes("nut") || x.includes("peanut"))) return true;
      if (a === "dairy" && (rAll.includes("dairy") || rIng.some((i) => ["milk", "butter", "cheese", "cream", "yogurt", "mozzarella", "feta"].includes(i))))
        return true;
      if (a === "gluten" && (rAll.includes("gluten") || rIng.some((i) => ["pasta", "bread", "noodles", "tortilla", "flour"].includes(i))))
        return true;
      if (a === "shellfish" && (rAll.includes("shellfish") || rIng.includes("shrimp"))) return true;
      if (a === "fish" && (rAll.includes("fish") || rIng.includes("tuna") || rIng.includes("salmon")))
        return true;
      if (a === "egg" && (rAll.includes("egg") || rIng.includes("egg"))) return true;
      if (a === "soy" && (rAll.includes("soy") || rIng.some((i) => i.includes("soy") || i === "tofu" || i === "miso")))
        return true;
      if (a === "sesame" && (rAll.includes("sesame") || rIng.includes("sesame") || rIng.includes("tahini")))
        return true;
    }
    return false;
  }

  function hasExclusionConflict(recipe, exclusions) {
    if (!exclusions.length) return false;
    const all = [...(recipe.ingredients || []), ...(recipe.optional || [])].map((x) =>
      x.toLowerCase()
    );
    return exclusions.some((e) => all.includes(e) || all.some((i) => i.includes(e)));
  }

  function scoreRecipe(recipe, ctx) {
    const { ingredients, taste, prep, eat, allergens, exclusions } = ctx;

    if (hasAllergenConflict(recipe, allergens)) return { score: -Infinity, reason: "allergen" };
    if (hasExclusionConflict(recipe, exclusions)) return { score: -Infinity, reason: "exclusion" };

    const req = recipe.ingredients || [];
    const opt = recipe.optional || [];
    const have = new Set(ingredients);

    let matchedReq = 0;
    let missingReq = [];
    for (const r of req) {
      if (have.has(r) || [...have].some((h) => h.includes(r) || r.includes(h))) {
        matchedReq++;
      } else {
        missingReq.push(r);
      }
    }

    let matchedOpt = 0;
    for (const o of opt) {
      if (have.has(o) || [...have].some((h) => h.includes(o) || o.includes(h))) matchedOpt++;
    }

    // Must match at least 40% of required OR 2+ required ingredients
    const cover = req.length ? matchedReq / req.length : 0;
    if (matchedReq < 2 && cover < 0.4) {
      return { score: -Infinity, reason: "low-cover", cover, matchedReq, missingReq };
    }

    let score = 0;
    score += cover * 100;
    score += matchedOpt * 4;
    score += matchedReq * 8;

    // Bonus if user ingredients are well utilized
    const used = ingredients.filter(
      (i) =>
        req.some((r) => r === i || r.includes(i) || i.includes(r)) ||
        opt.some((o) => o === i || o.includes(i) || i.includes(o))
    );
    score += (used.length / Math.max(ingredients.length, 1)) * 20;

    // Taste
    score *= tasteMatch(recipe.taste || [], taste);

    // Time fit
    const total = recipe.total || (recipe.prep || 0) + (recipe.cook || 0);
    const prepR = recipe.prep || 0;
    if (prep && prepR > prep * 1.4) score *= 0.35;
    else if (prep && prepR <= prep) score *= 1.15;

    if (eat && total > eat * 1.5) score *= 0.3;
    else if (eat && total <= eat) score *= 1.15;
    else if (eat && total <= eat * 1.2) score *= 1.0;

    // Prefer fewer missing pantry staples
    const staples = new Set(["salt", "oil", "water", "pepper", "butter"]);
    const realMissing = missingReq.filter((m) => !staples.has(m));
    score -= realMissing.length * 6;

    // slight preference for shorter recipes when times are tight
    if (eat && eat <= 15) score += Math.max(0, 20 - total);

    return {
      score,
      cover,
      matchedReq,
      matchedOpt,
      missingReq: realMissing,
      used,
    };
  }

  function formatRecipe(recipe, meta, ctx) {
    const lines = [];
    lines.push(`${recipe.emoji || "🍊"} ${recipe.name}`);
    lines.push("");
    lines.push(
      `Taste: ${(recipe.taste || []).join(", ")} · Prep ~${recipe.prep}m · Total ~${recipe.total}m`
    );
    if (meta.missingReq && meta.missingReq.length) {
      lines.push(`You may need: ${meta.missingReq.join(", ")}`);
    }
    lines.push("");
    lines.push("Ingredients:");
    for (const ing of recipe.ingredients) {
      const have =
        ctx.ingredients.includes(ing) ||
        ctx.ingredients.some((h) => h.includes(ing) || ing.includes(h));
      lines.push(`- ${ing}${have ? "" : " (grab if missing)"}`);
    }
    if (recipe.optional && recipe.optional.length) {
      const haveOpt = recipe.optional.filter(
        (o) =>
          ctx.ingredients.includes(o) ||
          ctx.ingredients.some((h) => h.includes(o) || o.includes(h))
      );
      if (haveOpt.length) {
        lines.push(`Nice extras you have: ${haveOpt.join(", ")}`);
      }
    }
    lines.push("");
    lines.push("Steps:");
    recipe.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    if (recipe.tips) {
      lines.push("");
      lines.push(`Tip: ${recipe.tips}`);
    }
    return lines.join("\n");
  }

  /**
   * Main entry — returns one perfect recipe object
   */
  function generate(input) {
    const ingredients = unique(parseList(input.ingredients));
    const allergens = unique(parseList(input.allergens));
    const exclusions = unique(parseList(input.exclusions));
    const taste = (input.taste || "any").toLowerCase().trim() || "any";
    const prep = parseInt(input.prep, 10) || 30;
    const eat = parseInt(input.eat, 10) || 45;

    if (!ingredients.length) {
      return { error: "Please enter at least one ingredient." };
    }

    const ctx = { ingredients, taste, prep, eat, allergens, exclusions };
    const scored = [];

    for (const recipe of RECIPES()) {
      const meta = scoreRecipe(recipe, ctx);
      if (meta.score > -Infinity) {
        scored.push({ recipe, meta });
      }
    }

    scored.sort((a, b) => b.meta.score - a.meta.score);

    if (!scored.length) {
      // Fallback: invent a minimal free-form recipe from ingredients
      return inventFallback(ctx);
    }

    // Deterministic "one best" — if top two are very close, still pick top
    const best = scored[0];
    const text = formatRecipe(best.recipe, best.meta, ctx);

    return {
      recipe: text,
      source: "local",
      name: best.recipe.name,
      emoji: best.recipe.emoji,
      id: best.recipe.id,
      score: Math.round(best.meta.score * 10) / 10,
      meta: {
        cover: best.meta.cover,
        missing: best.meta.missingReq,
        matched: best.meta.matchedReq,
        total: best.recipe.total,
        prep: best.recipe.prep,
        taste: best.recipe.taste,
        steps: best.recipe.steps,
        ingredients: best.recipe.ingredients,
        optional: best.recipe.optional,
        tips: best.recipe.tips,
        alternatives: scored.slice(1, 4).map((s) => ({
          id: s.recipe.id,
          name: s.recipe.name,
          emoji: s.recipe.emoji,
          score: Math.round(s.meta.score * 10) / 10,
        })),
      },
    };
  }

  function inventFallback(ctx) {
    const main = ctx.ingredients.slice(0, 6);
    const name = `${main[0].charAt(0).toUpperCase() + main[0].slice(1)} ${ctx.taste === "any" ? "Skillet" : ctx.taste.charAt(0).toUpperCase() + ctx.taste.slice(1)} Bowl`;
    const steps = [
      `Prep all ingredients: ${main.join(", ")}.`,
      `Heat a pan with oil (or water for steaming). Add aromatics first if you have garlic/onion.`,
      `Add the firmer items from your list; cook until nearly done.`,
      `Season for a ${ctx.taste === "any" ? "balanced savory" : ctx.taste} profile — salt, and whatever spices you have.`,
      `Combine remaining items; cook until everything is safe and tasty. Taste and adjust.`,
      `Plate and eat within your time budget.`,
    ];
    const lines = [
      `🍊 ${name}`,
      "",
      `Improvised from your kitchen · ~${Math.min(ctx.eat, 25)}m`,
      "",
      "Ingredients:",
      ...main.map((i) => `- ${i}`),
      "",
      "Steps:",
      ...steps.map((s, i) => `${i + 1}. ${s}`),
      "",
      "Tip: This is a free local fallback — add more common ingredients next time for a curated match.",
    ];
    return {
      recipe: lines.join("\n"),
      source: "local-fallback",
      name,
      emoji: "🍊",
      id: "fallback-" + Date.now(),
      meta: {
        cover: 1,
        missing: [],
        matched: main.length,
        total: Math.min(ctx.eat, 25),
        prep: Math.min(ctx.prep, 10),
        taste: [ctx.taste],
        steps,
        ingredients: main,
        optional: [],
        tips: "Add pantry staples for better matches.",
        alternatives: [],
      },
    };
  }

  function listQuickCombos() {
    return [
      { label: "Tomato · Rice · Egg", ingredients: "tomato, rice, egg, soy sauce", taste: "umami" },
      { label: "Pasta · Garlic · Butter", ingredients: "pasta, garlic, butter, salt", taste: "savory" },
      { label: "Chickpea · Tomato · Onion", ingredients: "chickpea, tomato, onion, garlic, oil", taste: "spicy" },
      { label: "Egg · Spinach · Cheese", ingredients: "egg, spinach, cheese, oil", taste: "mild" },
      { label: "Banana · Oats · Egg", ingredients: "banana, oats, egg", taste: "sweet" },
      { label: "Tortilla · Cheese · Bean", ingredients: "tortilla, cheese, black bean, oil", taste: "savory" },
      { label: "Chicken · Lemon · Garlic", ingredients: "chicken, lemon, garlic, oil", taste: "fresh" },
      { label: "Rice · Kimchi · Egg", ingredients: "rice, kimchi, egg, oil, soy sauce", taste: "spicy" },
    ];
  }

  function shoppingList(recipeMeta, haveList) {
    const have = new Set(parseList(haveList));
    const need = [];
    for (const ing of recipeMeta.ingredients || []) {
      const ok =
        have.has(ing) || [...have].some((h) => h.includes(ing) || ing.includes(h));
      if (!ok && ing !== "salt" && ing !== "water") need.push(ing);
    }
    return need;
  }

  global.JustOrangeEngine = {
    generate,
    parseList,
    normalizeToken,
    listQuickCombos,
    shoppingList,
    recipes: RECIPES,
  };
})(typeof window !== "undefined" ? window : globalThis);
