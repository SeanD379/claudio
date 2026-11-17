export async function importSelectedPlaylists(
  ids: Iterable<number>,
  importPlaylist: (id: string) => Promise<void>
) {
  const completedIds: number[] = [];
  const failedIds: number[] = [];
  let importedCount = 0;
  let firstError = "";
  for (const id of ids) {
    try {
      await importPlaylist(String(id));
      completedIds.push(id);
      importedCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败，请重试";
      if (message.toLowerCase().includes("already imported") || message.includes("409")) {
        completedIds.push(id);
      } else {
        failedIds.push(id);
        firstError ||= message;
      }
    }
  }
  return {
    completedIds, failedIds, importedCount,
    error: failedIds.length
      ? `${importedCount ? `已导入 ${importedCount} 个歌单；` : ""}${firstError}（${failedIds.length} 个未导入，已保留选择）`
      : "",
  };
}
