import assert from "node:assert/strict";
import { test } from "node:test";
import { importSelectedPlaylists } from "./playlist-import";

test("显示实际的导入错误，并保留失败项供重试", async () => {
  const result = await importSelectedPlaylists([1], async () => {
    throw new Error("暂时无法获取网易云歌单，请稍后重试");
  });
  assert.deepEqual(result.failedIds, [1]);
  assert.match(result.error, /暂时无法获取网易云歌单/);
  assert.match(result.error, /保留选择/);
});

test("部分成功后仅重试失败项，不重复导入已成功的歌单", async () => {
  const attempted: string[] = [];
  const first = await importSelectedPlaylists([1, 2, 3], async (id) => {
    attempted.push(id);
    if (id === "2") throw new Error("网络错误");
  });
  assert.deepEqual(first.completedIds, [1, 3]);
  assert.equal(first.importedCount, 2);
  assert.match(first.error, /已导入 2 个歌单/);
  const second = await importSelectedPlaylists(first.failedIds, async (id) => { attempted.push(id); });
  assert.deepEqual(attempted, ["1", "2", "3", "2"]);
  assert.deepEqual(second.failedIds, []);
  assert.equal(second.error, "");
});

test("已经导入的歌单不被误当作失败再次选中", async () => {
  const result = await importSelectedPlaylists([1, 2], async (id) => {
    if (id === "1") throw new Error("Playlist already imported");
    throw new Error("网易云登录已失效，请重新扫码");
  });
  assert.deepEqual(result.completedIds, [1]);
  assert.deepEqual(result.failedIds, [2]);
  assert.equal(result.importedCount, 0);
  assert.match(result.error, /登录已失效/);
});
