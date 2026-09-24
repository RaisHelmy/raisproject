import { Link } from "react-router-dom";
import { HfHeader } from "../../app/header/HfHeader";
import { COURSES, PROMPT_BANK, type Course } from "./pagesData2";

/**
 * Academy: the most popular courses as wide rows with artwork, meta chips and
 * two calls to action, then the prompt bank of camera moves.
 */
export function AcademyPage() {
  return (
    <>
      <HfHeader />
      <main id="main" className="pg pg-academy">
        <div className="pg-container">
          <h1 className="pg-academy-title">Most popular courses</h1>

          <div className="pg-courses">
            {COURSES.map((c) => <CourseRow key={c.title} course={c} />)}
          </div>

          <div className="pg-showall">
            <button type="button" className="pg-btn pg-btn-grey">Show all<ChevronIcon /></button>
          </div>

          <section className="pg-bank">
            <h2>Prompt bank</h2>
            <h3>Camera</h3>
            <div className="pg-bank-chips">
              {PROMPT_BANK.map((t) => (
                <button key={t} type="button" className="pg-bank-chip">{t}<CopyIcon /></button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function CourseRow({ course }: { course: Course }) {
  return (
    <article className="pg-course">
      <figure className="pg-course-art"><img src={course.img} alt="" loading="lazy" decoding="async" /></figure>
      <div className="pg-course-body">
        <h2>{course.title}</h2>
        <p>{course.desc}</p>
        <div className="pg-course-chips">
          {course.chips.map((c, i) => (
            <span key={c} className="pg-course-chip">{CHIP_ICON[i] ?? <DotIcon />}{c}</span>
          ))}
        </div>
        <div className="pg-course-actions">
          <Link to="/signup" className="pg-btn pg-btn-lime">Start now for free</Link>
          <button type="button" className="pg-btn pg-btn-ghost">View details</button>
        </div>
      </div>
    </article>
  );
}

const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const CameraIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...s} /><path d="M12 3.5v17M3.5 12h17" {...s} /></svg>;
const LevelIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M5 19v-5M12 19V8M19 19v-9" {...s} /></svg>;
const ModulesIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M4 8.5L12 5l8 3.5-8 3.5-8-3.5Z" {...s} /><path d="M4 12l8 3.5 8-3.5M4 15.5L12 19l8-3.5" {...s} /></svg>;
const ClockIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...s} /><path d="M12 7.5V12l3 2" {...s} /></svg>;
const DotIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>;
const CHIP_ICON = [<CameraIcon key="a" />, <LevelIcon key="b" />, <ModulesIcon key="c" />, <ClockIcon key="d" />];
const ChevronIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M9 5l7 7-7 7" {...s} /></svg>;
const CopyIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" {...s} /><path d="M5 15V6a2 2 0 0 1 2-2h9" {...s} /></svg>;
