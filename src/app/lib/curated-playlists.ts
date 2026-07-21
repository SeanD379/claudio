// 网易云音乐音综/演唱会歌单合集
// ID 为网易云 playlist ID，可在 https://music.163.com/#/playlist?id=xxx 找到

export interface CuratedPlaylist {
  id: string;
  name: string;
  description: string;
  gradient: string;
}

export const curatedPlaylists: CuratedPlaylist[] = [
  {
    id: "2795491403",
    name: "歌手2025",
    description: "湖南卫视音乐竞技节目 · 208首",
    gradient: "from-red-500/40 to-orange-500/40",
  },
  {
    id: "7464492458",
    name: "声生不息",
    description: "港乐经典重现 · 全季收录",
    gradient: "from-blue-500/40 to-cyan-500/40",
  },
  {
    id: "7428632302",
    name: "时光音乐会",
    description: "经典歌曲全新演绎 · 239首",
    gradient: "from-amber-500/40 to-yellow-500/40",
  },
  {
    id: "7583198816",
    name: "中国好声音",
    description: "经典大合集 · 104首",
    gradient: "from-purple-500/40 to-pink-500/40",
  },
  {
    id: "7571447656",
    name: "蒙面歌王",
    description: "面具之下尽是好声音 · 100首",
    gradient: "from-emerald-500/40 to-teal-500/40",
  },
  {
    id: "2963848288",
    name: "我是歌手",
    description: "殿堂级音乐竞技 · 119首",
    gradient: "from-rose-500/40 to-red-500/40",
  },
];
