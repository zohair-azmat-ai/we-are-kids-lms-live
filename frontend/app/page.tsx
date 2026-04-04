import Image from "next/image";

import { BackendStatus } from "@/components/backend-status";
import { SiteHeader } from "@/components/site-header";

const trustItems = [
  "KHDA Ready",
  "Parent Friendly",
  "Safe Learning",
  "Live Classes",
  "Recordings",
];

const features = [
  {
    title: "Live Classes",
    text: "Warm, interactive online lessons that help children stay connected to their teachers every day.",
    accent: "bg-blue-100 text-blue-700",
  },
  {
    title: "Lesson Recordings",
    text: "Families can replay important lessons later so learning feels calm, flexible, and easy to revisit.",
    accent: "bg-red-100 text-red-600",
  },
  {
    title: "Teacher Dashboard",
    text: "Teachers can guide classes, share activities, and keep lesson plans organized in one place.",
    accent: "bg-amber-100 text-amber-700",
  },
  {
    title: "Student Access",
    text: "Simple class access helps young learners join quickly and focus on the joy of learning.",
    accent: "bg-sky-100 text-sky-700",
  },
];

const steps = [
  {
    number: "01",
    title: "Join live lesson",
    text: "Children join their class with a simple, parent-friendly flow.",
  },
  {
    number: "02",
    title: "Learn with teacher",
    text: "Teachers guide lessons in a warm and engaging online classroom.",
  },
  {
    number: "03",
    title: "Watch replay later",
    text: "Families can revisit key moments after class whenever needed.",
  },
];

const newsCards = [
  {
    title: "Building joyful online routines",
    text: "Simple daily learning habits help children feel safe, ready, and excited for every lesson.",
    image: "/images/students.png",
  },
  {
    title: "Why parents love recorded lessons",
    text: "Short replay access makes it easier to review class highlights at home with confidence.",
    image: "/images/tablet.png",
  },
  {
    title: "Creating a calm digital classroom",
    text: "A clear layout and gentle structure help young learners stay focused without overwhelm.",
    image: "/images/contract.png",
  },
];

const testimonials = [
  {
    quote:
      "The platform feels warm and simple. My child joins class easily and I always know what is happening.",
    author: "Parent Review",
  },
  {
    quote:
      "Teachers can move through lessons smoothly, and the children feel comfortable from the start.",
    author: "Teacher Review",
  },
  {
    quote:
      "It looks like a real school website, not a confusing portal. That makes a big difference for families.",
    author: "School Admin",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-transparent">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-4 sm:px-6 sm:pt-6 lg:px-10">
        <SiteHeader />

        <section
          id="home"
          className="relative mt-6 overflow-hidden rounded-[2.5rem] bg-white px-5 py-10 shadow-soft sm:px-8 sm:py-12 lg:px-10 lg:py-16"
        >
          <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-blue-100/80 sm:h-44 sm:w-44" />
          <div className="absolute right-2 top-6 h-20 w-20 rounded-full bg-red-100 sm:right-8 sm:top-8 sm:h-28 sm:w-28" />
          <div className="absolute bottom-8 left-1/3 h-20 w-20 rounded-full bg-amber-100 sm:h-24 sm:w-24" />
          <div className="absolute bottom-12 right-1/4 h-16 w-16 rounded-full bg-sky-100 sm:h-20 sm:w-20" />

          <div className="relative grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                Welcome to We Are Kids Nursery
              </div>
              <h1 className="mt-6 text-4xl font-semibold leading-tight text-slate-800 sm:text-5xl lg:text-6xl">
                Caring Hands, Creative Minds
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                A warm and colorful online learning home where children feel
                supported, parents feel confident, and teachers can guide every
                lesson with ease.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="#classes"
                  className="inline-flex items-center justify-center rounded-full bg-red-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-100 transition hover:-translate-y-0.5"
                >
                  Explore Classes
                </a>
                <a
                  href="#about"
                  className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-6 py-3.5 text-sm font-semibold text-blue-600 transition hover:border-blue-300 hover:bg-blue-50"
                >
                  Learn More
                </a>
              </div>
            </div>

            <div className="relative pl-0 lg:pl-10">
              <div className="absolute -left-4 top-10 hidden h-[78%] w-24 rounded-[2rem] bg-red-400 lg:block" />
              <div className="absolute -right-4 bottom-6 hidden h-24 w-24 rounded-full bg-amber-300 lg:block" />
              <div className="relative h-[320px] w-full overflow-hidden rounded-[2rem] shadow-2xl sm:h-[420px] lg:h-[520px]">
                <Image
                  src="/images/hero.png"
                  alt="Children learning together in a classroom"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-slate-100 bg-white px-5 py-5 shadow-soft sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {trustItems.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-center text-sm font-semibold text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section
          id="about"
          className="mt-14 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center"
        >
          <div className="relative">
            <div className="absolute -left-4 -top-4 h-20 w-20 rounded-full bg-yellow-100 sm:h-24 sm:w-24" />
            <div className="absolute -bottom-4 right-6 h-16 w-16 rounded-full bg-red-100 sm:right-8 sm:h-20 sm:w-20" />
            <div className="relative overflow-hidden rounded-[2.5rem] bg-white p-4 shadow-soft sm:p-5">
              <div className="relative h-[320px] overflow-hidden rounded-[2rem] sm:h-[420px] lg:h-[460px]">
                <Image
                  src="/images/live-class.png"
                  alt="Children enjoying nursery learning"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-red-500">
              About Us
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-slate-800 sm:text-4xl lg:text-5xl">
              A joyful space for early learning and live online classes
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">
              We Are Kids Nursery brings together warm teaching, simple access,
              and family-friendly online learning. Our goal is to make every
              school day feel structured, safe, and inspiring for young learners.
            </p>
            <a
              href="#contact"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-100 transition hover:-translate-y-0.5"
            >
              Discover More
            </a>
          </div>
        </section>

        <section id="classes" className="mt-16">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
              What We Provide
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-slate-800 sm:text-4xl lg:text-5xl">
              Learning support made simple for every family
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="card-hover rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft"
              >
                <div
                  className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${feature.accent}`}
                >
                  {feature.title}
                </div>
                <p className="mt-5 text-base leading-7 text-slate-600">
                  {feature.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-600">
              How It Works
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-slate-800 sm:text-4xl lg:text-5xl">
              A simple learning journey for children and parents
            </h2>

            <div className="mt-8 space-y-5">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-soft"
                >
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-sm font-bold text-white">
                      {step.number}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-800">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-base leading-7 text-slate-600">
                        {step.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.5rem] bg-white p-4 shadow-soft sm:p-5">
            <div className="relative h-[320px] overflow-hidden rounded-[2rem] sm:h-[460px] lg:h-[520px]">
              <Image
                src="/images/students.png"
                alt="Online nursery learning"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </section>

        <section id="gallery" className="mt-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-red-500">
                Latest Blog & News
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-800 sm:text-4xl lg:text-5xl">
                Stories, updates, and school moments
              </h2>
            </div>
            <a href="#contact" className="text-sm font-semibold text-blue-600">
              View More
            </a>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {newsCards.map((card) => (
              <article
                key={card.title}
                className="card-hover overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-soft"
              >
                <div className="relative h-56">
                  <Image
                    src={card.image}
                    alt={card.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-semibold text-slate-800">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-base leading-7 text-slate-600">
                    {card.text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          id="contact"
          className="mt-16 grid gap-10 rounded-[2.5rem] bg-white px-5 py-8 shadow-soft sm:px-8 sm:py-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 lg:py-12"
        >
          <div className="relative">
            <div className="absolute -left-2 top-8 h-20 w-20 rounded-full bg-blue-100 sm:h-24 sm:w-24" />
            <div className="absolute bottom-8 right-6 h-16 w-16 rounded-full bg-yellow-100 sm:h-20 sm:w-20" />
            <div className="relative overflow-hidden rounded-[2.5rem]">
              <div className="relative h-[320px] sm:h-[420px] lg:h-[520px]">
                <Image
                  src="/images/contract.png"
                  alt="Children enjoying learning time"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
              Join Classes
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-slate-800 sm:text-4xl lg:text-5xl">
              Let&apos;s help your child get started
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
              Share your details and our team will help you explore the best
              class experience for your child.
            </p>

            <form className="mt-8 grid gap-4">
              <input
                type="text"
                placeholder="Your name"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
              />
              <input
                type="email"
                placeholder="Email address"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
              />
              <input
                type="tel"
                placeholder="Phone number"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
              />
              <textarea
                placeholder="Message"
                rows={5}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
              />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-red-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-100 transition hover:-translate-y-0.5 sm:w-fit"
              >
                Send Enquiry
              </button>
            </form>
          </div>
        </section>

        <section className="mt-16">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
              Parent Reviews
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-slate-800 sm:text-4xl lg:text-5xl">
              Warm words from our community
            </h2>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {testimonials.map((item) => (
              <article
                key={item.author}
                className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft"
              >
                <p className="text-base leading-7 text-slate-600">
                  "{item.quote}"
                </p>
                <p className="mt-5 text-sm font-semibold text-slate-800">
                  {item.author}
                </p>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-12">
          <BackendStatus />
        </div>

        <footer className="mt-16 rounded-[2.5rem] bg-slate-800 px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.7fr_0.7fr_0.9fr]">
            <div>
              <div className="flex items-center gap-3">
                <Image
                  src="/images/logo.png"
                  alt="We Are Kids Nursery"
                  width={52}
                  height={52}
                  className="h-12 w-auto object-contain"
                />
                <div>
                  <p className="text-lg font-bold">We Are Kids Nursery</p>
                  <p className="text-sm text-slate-300">
                    Bright online learning for young minds
                  </p>
                </div>
              </div>
              <p className="mt-5 max-w-sm text-sm leading-7 text-slate-300">
                A warm and welcoming nursery website experience designed for
                children, teachers, and parents.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold">Links</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <a href="/#home" className="block">
                  Home
                </a>
                <a href="/#about" className="block">
                  About
                </a>
                <a href="/#classes" className="block">
                  Classes
                </a>
                <a href="/#contact" className="block">
                  Contact
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold">Classes</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>Live Classes</p>
                <p>Recorded Lessons</p>
                <p>Teacher Support</p>
                <p>Parent Access</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold">Contact</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>hello@wearekidsnursery.com</p>
                <p>+971 000 000 000</p>
                <p>Dubai, United Arab Emirates</p>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-700 pt-6 text-sm text-slate-400">
            Copyright 2026 We Are Kids Nursery. All rights reserved.
          </div>
        </footer>
      </div>
    </main>
  );
}
