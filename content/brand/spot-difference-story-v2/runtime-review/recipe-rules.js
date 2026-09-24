// Positive-area intersection is exclusive; touching edges alone are allowed.
function differenceCandidatesConflict(a, b) {
    return a.zone == b.zone || (Math.max(a.x, b.x) < Math.min(a.x + a.w, b.x + b.w) && Math.max(a.y, b.y) < Math.min(a.y + a.h, b.y + b.h));
}
function searchDifferenceRecipe(pool, start, count, picked) {
    if (picked.length == count)
        return true;
    if (pool.length - start < count - picked.length)
        return false;
    for (let i = start; i < pool.length; i++) {
        const item = pool[i];
        if (picked.some((other) => differenceCandidatesConflict(item, other)))
            continue;
        picked.push(item);
        if (searchDifferenceRecipe(pool, i + 1, count, picked))
            return true;
        picked.pop();
    }
    return false;
}
function canMakeDifferenceRecipe(items, count) {
    if (count <= 0)
        return true;
    return searchDifferenceRecipe(items, 0, count, []);
}
function chooseDifferenceRecipe(items, count) {
    if (count <= 0)
        return [];
    const pool = items.slice();
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const item = pool[i];
        pool[i] = pool[j];
        pool[j] = item;
    }
    const picked = [];
    if (!searchDifferenceRecipe(pool, 0, count, picked))
        return [];
    return picked.map((item) => item.id);
}
function seenKey(tier) { return localTestKey('focus_difference_seen_v1_' + tier); }
function seenIds(tier) {
    const raw = uni.getStorageSync(seenKey(tier));
    if (raw == null || raw == '')
        return [];
    try {
        const ids = JSON.parse(JSON.stringify(raw));
        return ids == null ? [] : ids;
    }
    catch (_error) {
        return [];
    }
}
function chooseUnseenDifference(tier, scenes, minimumTargets = 0) {
    const pool = scenes.filter((scene) => scene.tier == tier && canMakeDifferenceRecipe(scene.regions, minimumTargets));
    if (pool.length == 0)
        return null;
    const seen = seenIds(tier);
    let available = pool.filter((scene) => seen.indexOf(scene.id) < 0);
    if (available.length == 0) {
        const rawLast = uni.getStorageSync(seenKey(tier) + '_last');
        const last = rawLast == null ? '' : rawLast;
        available = pool.filter((scene) => pool.length == 1 || scene.id != last);
    }
    return available[Math.floor(Math.random() * available.length)];
}
// Called when the scene image loads on screen, never on completion or prefetch.
function markDifferenceShown(scene, scenes, minimumTargets = 0) {
    const all = scenes.filter((item) => item.tier == scene.tier);
    const pool = all.filter((item) => canMakeDifferenceRecipe(item.regions, minimumTargets));
    let seen = seenIds(scene.tier).filter((id) => all.some((item) => item.id == id));
    // Start a new eligible cycle without forgetting smaller scenes seen at earlier levels.
    if (pool.every((item) => seen.indexOf(item.id) >= 0))
        seen = seen.filter((id) => !pool.some((item) => item.id == id));
    if (seen.indexOf(scene.id) < 0)
        seen.push(scene.id);
    uni.setStorageSync(seenKey(scene.tier), seen);
    uni.setStorageSync(seenKey(scene.tier) + '_last', scene.id);
}
