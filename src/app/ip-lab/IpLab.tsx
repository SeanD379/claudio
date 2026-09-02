"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowUpRight, Check, ChevronRight, Copy, Disc3, Play, Sparkles } from "lucide-react";

type ConceptId = "soni" | "clau" | "mero";

interface Concept {
  id: ConceptId;
  name: string;
  chineseName: string;
  tagline: string;
  role: string;
  palette: string;
  accent: string;
  accentSoft: string;
  surface: string;
  ink: string;
  image: string;
  alt: string;
  insight: string;
  product: string;
  merch: string;
  content: string[];
  prompt: string;
}

const concepts: Concept[] = [
  {
    id: "soni",
    name: "Soni",
    chineseName: "声栖",
    tagline: "替你守住深夜的声音",
    role: "深夜情绪陪伴型玻璃蛙",
    palette: "蕨叶绿 · 海玻璃薄荷 · 雾白",
    accent: "#86d39f",
    accentSoft: "rgba(134, 211, 159, 0.15)",
    surface: "#17271e",
    ink: "#102016",
    image: "/ip-lab/soni-glass-frog-concept-v2.png",
    alt: "声栖 Soni 玻璃蛙概念立绘：玉绿色玻璃蛙带有海玻璃监听耳罩与胸口薄荷微光",
    insight: "一只栖在耳机与唱片之间的玻璃蛙。它把没说出口的心情收进胸口的微光里，安静陪着你听完这一首。",
    product: "生成今晚情绪卡，说明推荐缘由，并引导保存一首歌到夜晚歌单。",
    merch: "玻璃蛙声核钥匙扣、半透明趾吸盘挂件、薄荷夜光小夜灯。",
    content: ["今晚不想和任何人说话时，声栖替你放这首歌", "独居人的 23:47 声音日记", "把今天的情绪装进一张虚拟黑胶"],
    prompt: "今晚不想和任何人说话时，声栖替你放这首歌。选一首歌，生成你的 23:47 情绪卡。",
  },
  {
    id: "clau",
    name: "Clau",
    chineseName: "舞台猫",
    tagline: "每个普通人都值得一束追光",
    role: "KTV 自我表达型舞台搭子",
    palette: "炭黑 · 深紫 · 暖金",
    accent: "#d4a574",
    accentSoft: "rgba(212, 165, 116, 0.15)",
    surface: "#211812",
    ink: "#201811",
    image: "/ip-lab/clau-concept.png",
    alt: "Clau 舞台猫概念立绘，佩戴监听耳机并有麦克风线尾巴",
    insight: "白天有点怂，上台就发光。它擅长把社交疲惫，拉回属于自己的三分钟舞台。",
    product: "生成本周主打歌与舞台色盘，跳转 KTV 点歌、排队和歌词舞台。",
    merch: "换装毛绒、磁吸麦克风、舞台灯底座、演出季徽章。",
    content: ["社恐进 KTV 前 vs 点到第一首歌后", "如果情绪也有返场", "独居人把客厅唱成万人场"],
    prompt: "社恐进 KTV 前 vs 点到第一首歌后。选一句最想唱的歌词，领取你的舞台色盘。",
  },
  {
    id: "mero",
    name: "Mero",
    chineseName: "拾音兔",
    tagline: "把散掉的今天，缝成一首歌",
    role: "治愈手作型情绪整理师",
    palette: "燕麦 · 雾粉 · 暖棕",
    accent: "#d9a98f",
    accentSoft: "rgba(217, 169, 143, 0.15)",
    surface: "#2a1d19",
    ink: "#241713",
    image: "/ip-lab/mero-concept.png",
    alt: "Mero 拾音兔概念立绘，佩戴耳机并带有装着声音碎片的拾音包",
    insight: "慢热、细腻，喜欢替人记住小事。它把照片、车票和一首歌一起放进拾音包。",
    product: "生成今日声音便签，把心情、照片和歌保存为可回看的歌单记忆。",
    merch: "毛绒挂件、手账胶带、亚克力唱片夹、DIY 拾音包。",
    content: ["给今天的自己留一段 8 秒声音", "一人食 / 下班 / 雨天的听歌桌搭", "把评论区的情绪做成 Mero 小卡"],
    prompt: "给今天的自己留一段 8 秒声音。选一张照片和一首歌，做成你的声音便签。",
  },
];

const funnel = [
  ["安全感", "一段听歌仪式", "情绪卡 / 声音便签"],
  ["归属感", "独居人的共同场景", "评论区共创"],
  ["尊重感", "可被看见的音乐品味", "舞台色盘 / 分享卡"],
  ["自我实现", "把生活写成一首歌", "保存歌单记忆"],
];

export function IpLab() {
  const [selectedId, setSelectedId] = useState<ConceptId>("soni");
  const [copied, setCopied] = useState(false);
  const selected = concepts.find((concept) => concept.id === selectedId) ?? concepts[0];

  const copyPrompt = async () => {
    await navigator.clipboard?.writeText(selected.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-full overflow-y-auto bg-[#17130f] text-[#f0ece4] selection:bg-[#d4a574]/30">
      <main className="relative isolate overflow-hidden px-5 py-6 sm:px-8 sm:py-10 lg:px-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_80%_16%,rgba(212,165,116,0.2),transparent_30%),radial-gradient(circle_at_12%_6%,rgba(100,76,52,0.42),transparent_32%)]" />
        <div className="mx-auto max-w-6xl">
          <header className="flex items-center justify-between gap-5 border-b border-[#f0ece4]/10 pb-5">
            <Link href="/" className="group inline-flex min-h-11 items-center gap-2 text-sm text-[#c8b7a5] transition-colors hover:text-[#f0ece4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a574] focus-visible:ring-offset-4 focus-visible:ring-offset-[#17130f]">
              <span className="font-serif text-lg text-[#f0ece4]">Claudio</span>
              <span className="h-1 w-1 rounded-full bg-[#d4a574]" />
              <span>IP Lab</span>
            </Link>
            <span className="rounded-full border border-[#d4a574]/30 bg-[#d4a574]/10 px-3 py-1.5 text-xs font-medium tracking-wide text-[#e8c89d]">0–30 天概念验证</span>
          </header>

          <section className="grid gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:py-20">
            <div>
              <p className="mb-5 flex items-center gap-2 text-sm text-[#d4a574]"><Sparkles className="h-4 w-4" /> 为独居青年的音乐陪伴而设计</p>
              <h1 className="max-w-3xl font-serif text-5xl leading-[1.06] tracking-tight sm:text-6xl lg:text-7xl">让一首歌，<br />有一个会陪你的名字。</h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-[#c8b7a5] sm:text-lg">这不是正式产品功能，而是 Claudio 的角色概念试验。三名候选角色，以不同的情绪入口带来注册、首播与歌单保存。</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#concepts" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#d4a574] px-5 text-sm font-semibold text-[#201811] transition hover:bg-[#e8c89d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0ece4] focus-visible:ring-offset-4 focus-visible:ring-offset-[#17130f]">挑选你的搭子 <ChevronRight className="h-4 w-4" /></a>
                <a href="#test-kit" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#f0ece4]/15 px-5 text-sm text-[#e2d7ca] transition hover:border-[#d4a574]/70 hover:bg-[#f0ece4]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a574] focus-visible:ring-offset-4 focus-visible:ring-offset-[#17130f]">查看测试包 <ArrowUpRight className="h-4 w-4" /></a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#f0ece4]/10 bg-[#251d15]/70 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur sm:p-7">
              <p className="text-xs font-semibold tracking-[0.18em] text-[#d4a574]">设计原则</p>
              <p className="mt-4 font-serif text-3xl leading-tight text-[#f4ece2]">“情绪陪伴”，而不是另一只为了卖萌的宠物。</p>
              <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#f0ece4]/10">
                {funnel.map(([need, scene, output]) => (
                  <div key={need} className="bg-[#201811] p-4">
                    <p className="text-sm font-medium text-[#f0ece4]">{need}</p>
                    <p className="mt-2 text-xs leading-5 text-[#aa9885]">{scene}</p>
                    <p className="mt-3 text-xs text-[#d4a574]">{output}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="concepts" className="scroll-mt-6 border-t border-[#f0ece4]/10 py-12 lg:py-16">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-[#d4a574]">三套独立角色路线</p>
                <h2 className="mt-2 font-serif text-4xl">先让用户选，再让数据决定。</h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-[#aa9885]">点击角色卡查看她/它应该如何被拍、被分享，并最终被带回 Claudio。</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {concepts.map((concept, index) => {
                const active = concept.id === selectedId;
                return (
                  <button key={concept.id} onClick={() => setSelectedId(concept.id)} aria-pressed={active} style={active ? { borderColor: concept.accent, backgroundColor: concept.surface } : undefined} className={`group relative min-h-[430px] overflow-hidden rounded-[1.75rem] border text-left transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a574] focus-visible:ring-offset-4 focus-visible:ring-offset-[#17130f] ${active ? "" : "border-[#f0ece4]/10 bg-[#201811] hover:border-[#d4a574]/40 hover:bg-[#261c14]"}`}>
                    <div className="absolute left-5 top-5 z-10 flex items-center gap-2"><span className="rounded-full border border-[#f0ece4]/15 bg-[#17130f]/60 px-2.5 py-1 text-xs text-[#e7ddd1]">0{index + 1}</span>{active && <span style={{ backgroundColor: concept.accent, color: concept.ink }} className="rounded-full px-2.5 py-1 text-xs font-semibold">正在查看</span>}</div>
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(0deg,rgba(23,19,15,0.98)_8%,rgba(23,19,15,0.15)_66%,transparent)]" />
                    <Image src={concept.image} alt={concept.alt} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-contain object-center p-2 transition duration-500 group-hover:scale-[1.035]" priority={concept.id === "soni"} />
                    <div className="absolute inset-x-5 bottom-5 z-10"><p style={{ color: concept.accent }} className="text-xs font-medium tracking-[0.16em]">{concept.role}</p><h3 className="mt-2 font-serif text-3xl">{concept.chineseName} <span className="text-lg text-[#c8b7a5]">{concept.name}</span></h3><p className="mt-1 text-sm text-[#d8c5b2]">{concept.tagline}</p></div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-8 border-t border-[#f0ece4]/10 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
            <AnimatePresence mode="wait">
              <motion.div key={selected.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} style={{ borderColor: selected.accent, backgroundColor: selected.surface }} className="rounded-[2rem] border p-6 sm:p-8">
                <p style={{ color: selected.accent }} className="text-sm">候选主推 · {selected.palette}</p>
                <h2 className="mt-3 font-serif text-5xl">{selected.chineseName}<span className="ml-3 text-2xl text-[#c8b7a5]">{selected.name}</span></h2>
                <p className="mt-5 text-base leading-8 text-[#d8c5b2]">{selected.insight}</p>
                <div className="mt-8 space-y-4 border-t border-[#f0ece4]/10 pt-6 text-sm leading-6"><p><span className="font-medium text-[#f0ece4]">产品入口：</span><span className="text-[#b9a795]">{selected.product}</span></p><p><span className="font-medium text-[#f0ece4]">首发周边：</span><span className="text-[#b9a795]">{selected.merch}</span></p></div>
              </motion.div>
            </AnimatePresence>

            <div id="test-kit" className="rounded-[2rem] border border-[#f0ece4]/10 bg-[#201811] p-6 sm:p-8">
              <div className="flex items-center gap-3"><span style={{ backgroundColor: selected.accentSoft, color: selected.accent }} className="flex h-10 w-10 items-center justify-center rounded-full"><Play className="h-4 w-4 fill-current" /></span><div><p className="text-sm font-medium text-[#f0ece4]">小红书首批样片选题</p><p className="text-xs text-[#aa9885]">6–15 秒：一句情绪钩子 + 一首歌 + 一张可保存的卡</p></div></div>
              <AnimatePresence mode="wait">
                <motion.div key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-7 space-y-3">
                  {selected.content.map((idea, index) => <div key={idea} className="flex gap-4 rounded-2xl bg-[#2a1f17] p-4"><span style={{ color: selected.accent }} className="font-serif text-2xl">0{index + 1}</span><p className="pt-1 text-sm leading-6 text-[#dfd0c0]">{idea}</p></div>)}
                </motion.div>
              </AnimatePresence>
              <button onClick={copyPrompt} style={{ borderColor: selected.accent, color: selected.accent }} className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a574] focus-visible:ring-offset-4 focus-visible:ring-offset-[#201811]">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "已复制测试文案" : "复制当前测试文案"}
              </button>
            </div>
          </section>

          <section className="border-t border-[#f0ece4]/10 py-12 lg:py-16">
            <p className="text-sm text-[#d4a574]">90 天验证纪律</p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {[['0–30 天', '制作三视图、表情/动作清单、样片与同口径落地页。此页即为概念验证入口。'], ['31–60 天', '每案发布 8–12 条；记录 3 秒留存、收藏率、评论关键词、点击与注册。'], ['61–90 天', '仅将胜出角色接入欢迎、推荐、空状态和分享卡；先用一个低成本周边做预售。']].map(([time, detail]) => <div key={time} className="rounded-2xl border border-[#f0ece4]/10 p-5"><p className="font-serif text-2xl text-[#f0ece4]">{time}</p><p className="mt-3 text-sm leading-6 text-[#aa9885]">{detail}</p></div>)}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#d4a574] px-6 py-5 text-[#201811]"><div><p className="font-serif text-2xl">默认候选：声栖 Soni</p><p className="mt-1 text-sm text-[#4c3626]">最贴合 Claudio 的私密听歌房与产品增长目标。</p></div><Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#201811] px-5 text-sm font-semibold text-[#f0ece4] transition hover:bg-[#39271a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0ece4] focus-visible:ring-offset-4 focus-visible:ring-offset-[#d4a574]">进入 Claudio <Disc3 className="h-4 w-4" /></Link></div>
          </section>
        </div>
      </main>
      </div>
    </MotionConfig>
  );
}
