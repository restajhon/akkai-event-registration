import { AKKAI_EVENT } from "@/lib/akkai-event";

import styles from "./landing.module.css";

export function GeneralEventRundown() {
  return (
    <section aria-labelledby="general-rundown-title" className={styles.section} id="rundown">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle} id="general-rundown-title">Rundown Acara</h2>
          </div>
          <p className={styles.sectionDescription}>Rangkaian acara AKKAI 2026 selama tiga hari.</p>
        </div>
        <div className={styles.rundownShell}>
          <div className={styles.rundownList}>
          {AKKAI_EVENT.homepageRundown.map((day) => (
            <details className={styles.rundownDay} key={day.day} open={day.day === "Day 1"}>
              <summary className={styles.rundownSummary}>
                <span className={styles.rundownSummaryText}>
                  <strong>{day.day}</strong>
                  <span>{day.date}</span>
                </span>
                <span aria-hidden="true">+</span>
              </summary>
              <ul className={styles.rundownItems}>
                  {day.items.map((item) => (
                    <li className={styles.rundownItem} key={`${day.day}-${item.time}-${item.title}`}>
                      <span>{item.time}</span>
                      <span>{item.title}</span>
                    </li>
                  ))}
              </ul>
            </details>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}
