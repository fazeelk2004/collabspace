"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useInView,
  animate,
  type Variants,
} from "framer-motion";
import {
  ArrowRight,
  KanbanSquare,
  MessageSquare,
  Radio,
  ShieldCheck,
  Zap,
  BarChart3,
  Sparkles,
  Users,
  MousePointer2,
  CheckCircle2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const features = [
  {
    icon: KanbanSquare,
    title: "Kanban boards",
    text: "Drag-and-drop tasks with priorities, labels, due dates and multi-assignees.",
    accent: "from-indigo-500 to-violet-500",
    span: "lg:col-span-2",
  },
  {
    icon: Radio,
    title: "Real-time everything",
    text: "Boards, comments and presence update instantly for every teammate. No refresh, ever.",
    accent: "from-emerald-500 to-teal-500",
    span: "",
  },
  {
    icon: MessageSquare,
    title: "Built-in chat",
    text: "Workspace channels, board discussions and direct messages with reactions.",
    accent: "from-sky-500 to-cyan-500",
    span: "",
  },
  {
    icon: ShieldCheck,
    title: "Roles & permissions",
    text: "Owner, admin, member and viewer roles with strict multi-tenant isolation.",
    accent: "from-amber-500 to-orange-500",
    span: "",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    text: "Completion trends, workload by member and overdue tracking per workspace.",
    accent: "from-rose-500 to-pink-500",
    span: "",
  },
  {
    icon: Zap,
    title: "Cloud-native & fast",
    text: "Dockerized, horizontally scalable, deployed on AWS ECS with Redis fan-out across instances.",
    accent: "from-violet-500 to-fuchsia-500",
    span: "lg:col-span-2",
  },
];

const stats = [
  { value: 50, suffix: "ms", label: "Median sync latency" },
  { value: 99.9, suffix: "%", decimals: 1, label: "Uptime" },
  { value: 12, suffix: "+", label: "Live event types" },
  { value: 4, suffix: "", label: "Granular roles" },
];

const steps = [
  {
    icon: Users,
    title: "Create a workspace",
    text: "Spin up a workspace in seconds and invite your team with a single link.",
  },
  {
    icon: KanbanSquare,
    title: "Plan on boards",
    text: "Break work into tasks, set priorities and due dates, assign teammates.",
  },
  {
    icon: Radio,
    title: "Ship together, live",
    text: "Watch cards move, messages land and presence light up — in real time.",
  },
];

const mockColumns = [
  {
    name: "To do",
    dot: "bg-slate-400",
    cards: [
      { title: "Design onboarding flow", tag: "Design", tagColor: "bg-violet-500/20 text-violet-300", progress: 0 },
      { title: "API rate limiting", tag: "Backend", tagColor: "bg-sky-500/20 text-sky-300", progress: 0 },
    ],
  },
  {
    name: "In progress",
    dot: "bg-indigo-400",
    cards: [
      { title: "Real-time presence", tag: "Core", tagColor: "bg-indigo-500/20 text-indigo-300", progress: 65 },
      { title: "Workspace analytics", tag: "Data", tagColor: "bg-rose-500/20 text-rose-300", progress: 40 },
    ],
  },
  {
    name: "Done",
    dot: "bg-emerald-400",
    cards: [
      { title: "Socket.io Redis adapter", tag: "Infra", tagColor: "bg-emerald-500/20 text-emerald-300", progress: 100 },
      { title: "Auth & sessions", tag: "Core", tagColor: "bg-indigo-500/20 text-indigo-300", progress: 100 },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Animation helpers                                                   */
/* ------------------------------------------------------------------ */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.21, 0.47, 0.32, 0.98] },
  }),
};

function CountUp({
  value,
  suffix,
  decimals = 0,
}: {
  value: number;
  suffix: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const motionValue = useMotionValue(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(motionValue, value, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = latest.toFixed(decimals) + suffix;
      },
    });
    return () => controls.stop();
  }, [inView, value, suffix, decimals, motionValue]);

  return <span ref={ref}>0{suffix}</span>;
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Navbar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/10 bg-slate-950/80 shadow-lg shadow-black/20 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <KanbanSquare className="h-4 w-4 text-white" />
          </span>
          CollabSpace
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          <a href="#features" className="transition-colors hover:text-white">Features</a>
          <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
          <a href="#stats" className="transition-colors hover:text-white">Performance</a>
        </nav>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="group inline-flex h-9 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-slate-900 transition-all hover:bg-slate-200"
            >
              Open app
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm text-slate-300 transition-colors hover:text-white sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="group inline-flex h-9 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-slate-900 transition-all hover:bg-slate-200"
              >
                Get started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}

function BoardMockup() {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 p-4 shadow-2xl shadow-indigo-950/50 backdrop-blur-xl sm:p-6">
      {/* window chrome */}
      <div className="mb-4 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-rose-500/80" />
        <span className="h-3 w-3 rounded-full bg-amber-500/80" />
        <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
        <div className="ml-4 hidden h-6 flex-1 items-center rounded-md bg-white/5 px-3 text-[11px] text-slate-500 sm:flex">
          collabspace.app / acme / product-launch
        </div>
        <div className="flex -space-x-2">
          {["bg-indigo-500", "bg-rose-500", "bg-emerald-500"].map((c, i) => (
            <span
              key={i}
              className={`flex h-6 w-6 items-center justify-center rounded-full ${c} ring-2 ring-slate-900 text-[10px] font-semibold text-white`}
            >
              {["A", "M", "J"][i]}
            </span>
          ))}
        </div>
      </div>

      {/* columns */}
      <div className="grid grid-cols-3 gap-3">
        {mockColumns.map((col, ci) => (
          <div key={col.name} className="rounded-xl bg-white/[0.03] p-2.5">
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              <span className="text-[11px] font-medium text-slate-300">{col.name}</span>
            </div>
            <div className="space-y-2">
              {col.cards.map((card, i) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + ci * 0.15 + i * 0.1, duration: 0.5 }}
                  className="rounded-lg border border-white/[0.06] bg-slate-800/80 p-2.5"
                >
                  <p className="mb-2 text-[11px] font-medium leading-snug text-slate-200">
                    {card.title}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${card.tagColor}`}>
                      {card.tag}
                    </span>
                    {card.progress === 100 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : card.progress > 0 ? (
                      <div className="h-1 w-12 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${card.progress}%` }}
                          transition={{ delay: 1.6, duration: 1, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400"
                        />
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* live cursor */}
      <motion.div
        className="pointer-events-none absolute z-10"
        initial={{ left: "70%", top: "60%", opacity: 0 }}
        animate={{
          left: ["70%", "40%", "42%", "65%", "70%"],
          top: ["60%", "45%", "75%", "70%", "60%"],
          opacity: 1,
        }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      >
        <MousePointer2 className="h-4 w-4 fill-rose-500 text-rose-500" />
        <span className="ml-3 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-medium text-white">
          Maya
        </span>
      </motion.div>

      {/* live toast */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -6] }}
        transition={{ duration: 4, times: [0, 0.1, 0.85, 1], repeat: Infinity, repeatDelay: 3, delay: 2.5 }}
        className="absolute -bottom-3 right-6 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/95 px-3 py-2 shadow-xl backdrop-blur"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[11px] text-slate-300">
          <span className="font-medium text-white">Maya</span> moved “Real-time presence”
        </span>
      </motion.div>
    </div>
  );
}

function Hero({ isAuthenticated }: { isAuthenticated: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const mockY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const mockRotate = useTransform(scrollYProgress, [0, 0.5], [0, 4]);
  const mockScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.94]);

  return (
    <section ref={ref} className="relative overflow-hidden pb-24 pt-36 sm:pt-44">
      {/* background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 left-1/4 h-[480px] w-[480px] rounded-full bg-indigo-600/25 blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -50, 0], y: [0, 40, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-16 right-1/5 h-[420px] w-[420px] rounded-full bg-violet-600/20 blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, 50, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-fuchsia-600/10 blur-[120px]"
        />
      </div>

      <motion.div
        style={{ y: textY, opacity: textOpacity }}
        className="relative mx-auto w-full max-w-4xl px-4 text-center sm:px-6"
      >
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-slate-300 backdrop-blur"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Real-time collaboration, live right now
          <Sparkles className="h-3 w-3 text-amber-300" />
        </motion.div>

        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="mx-auto max-w-3xl text-balance text-5xl font-bold tracking-tight text-white sm:text-7xl"
        >
          Where your team{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            plans, builds & ships
          </span>{" "}
          — together
        </motion.h1>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
          className="mx-auto mt-6 max-w-xl text-balance text-lg leading-relaxed text-slate-400"
        >
          Kanban boards, team chat and live presence in one fast workspace. Every change
          appears for everyone, instantly.
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            href={isAuthenticated ? "/dashboard" : "/register"}
            className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-8 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/40"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <span className="relative">Start collaborating</span>
            <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center rounded-full border border-white/15 bg-white/5 px-8 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/10"
          >
            Sign in
          </Link>
        </motion.div>
      </motion.div>

      {/* app mockup with parallax */}
      <motion.div
        style={{ y: mockY, rotateX: mockRotate, scale: mockScale }}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="relative mx-auto mt-20 w-full max-w-4xl px-4 [perspective:1200px] sm:px-6"
      >
        <div className="absolute inset-x-12 -top-6 h-full rounded-3xl bg-gradient-to-r from-indigo-500/30 via-violet-500/30 to-fuchsia-500/30 blur-2xl" />
        <BoardMockup />
      </motion.div>
    </section>
  );
}

function Stats() {
  return (
    <section id="stats" className="relative border-y border-white/5 bg-white/[0.02]">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 px-4 py-16 sm:px-6 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            custom={i}
            className="text-center"
          >
            <div className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
              <CountUp value={s.value} suffix={s.suffix} decimals={s.decimals ?? 0} />
            </div>
            <p className="mt-2 text-sm text-slate-400">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-6xl px-4 py-28 sm:px-6">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto mb-16 max-w-2xl text-center"
      >
        <span className="mb-4 inline-block rounded-full border border-indigo-400/20 bg-indigo-500/10 px-4 py-1 text-xs font-medium text-indigo-300">
          Everything in one place
        </span>
        <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Built for teams that move fast
        </h2>
        <p className="mt-4 text-balance text-lg text-slate-400">
          Stop juggling five tools. CollabSpace brings planning, chat and insight into a
          single real-time workspace.
        </p>
      </motion.div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            custom={i}
            whileHover={{ y: -6 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur transition-colors hover:border-white/[0.15] ${f.span}`}
          >
            <div
              className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${f.accent} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-25`}
            />
            <div
              className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} shadow-lg`}
            >
              <f.icon className="h-5 w-5 text-white" />
            </div>
            <h3 className="mb-2 font-semibold text-white">{f.title}</h3>
            <p className="text-sm leading-relaxed text-slate-400">{f.text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative border-t border-white/5 bg-white/[0.02] py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <span className="mb-4 inline-block rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-1 text-xs font-medium text-emerald-300">
            How it works
          </span>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-5xl">
            From zero to shipping in minutes
          </h2>
        </motion.div>

        <div className="relative grid gap-10 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-7 hidden h-px bg-gradient-to-r from-transparent via-white/20 to-transparent md:block" />
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              custom={i}
              className="relative text-center"
            >
              <div className="relative mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 shadow-lg">
                <s.icon className="h-6 w-6 text-indigo-400" />
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
              </div>
              <h3 className="mb-2 font-semibold text-white">{s.title}</h3>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-slate-400">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="relative overflow-hidden py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/20 blur-[140px]" />
      </div>
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="relative mx-auto max-w-3xl px-4 text-center sm:px-6"
      >
        <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Ready to work in{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            real time
          </span>
          ?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-balance text-lg text-slate-400">
          Create your workspace, invite the team and feel the difference of a tool that
          keeps up with you.
        </p>
        <div className="mt-10">
          <Link
            href={isAuthenticated ? "/dashboard" : "/register"}
            className="group inline-flex h-13 items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-10 py-4 text-base font-semibold text-white shadow-xl shadow-indigo-500/30 transition-all hover:scale-[1.03] hover:shadow-2xl hover:shadow-indigo-500/40"
          >
            Get started — it&apos;s free
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <KanbanSquare className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="font-medium text-slate-300">CollabSpace</span>
        </div>
        <p className="text-center">
          Real-time team collaboration. Built with Next.js, Socket.io, PostgreSQL, Redis &amp; AWS.
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LandingPage({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 25, restDelta: 0.001 });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30">
      {/* scroll progress bar */}
      <motion.div
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
      />
      <Navbar isAuthenticated={isAuthenticated} />
      <main>
        <Hero isAuthenticated={isAuthenticated} />
        <Stats />
        <Features />
        <HowItWorks />
        <CtaSection isAuthenticated={isAuthenticated} />
      </main>
      <Footer />
    </div>
  );
}
