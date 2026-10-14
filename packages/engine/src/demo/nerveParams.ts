/**
 * Nerve demo numbers (S-7; model §2.6; sources read in V-7). Only the demo entry
 * (`@lifepeek/engine/demo`, demo/nerve.ts) imports this file: no run, no module and no main-entry
 * file does, so the numbers never reach /sim's first download (R71/R74; check-budget.mjs looks for
 * `nmjDelayMs` there). The demo is a pure function, not a simulation module: it adds no signal and
 * changes no output of simulate().
 *
 * Fibre speeds per fibre type (Kiernan's table): the hot pan's heat is carried in by a thin myelinated
 * Aδ fibre (10–30 m/s), the command goes out on a thick myelinated Aα motor fibre (70–120 m/s), and
 * "myelin off" slows both legs to an unmyelinated C fibre (0.5–2.5 m/s). Byrne (Neuroscience Online
 * ch. 3): nerves conduct from 100 m/s to below 0.1 m/s. Synaptic delay "usually, approximately
 * 0.5-1 ms" at chemical synapses (Byrne ch. 6); the neuromuscular junction is given the same 0.5 ms
 * (an assumption: no page read gives its own delay). The hand withdrawal reflex "requires 2 spinal
 * cord synapses" (Davis, Cobb: Basic Human Physiology, IU). Path lengths: C7 spinous process to the
 * tip of the third finger 87.1 cm, to the olecranon 45.07 cm (Khosrawi 2018, 76 adults).
 *
 * Thinking time 150 ms: a simple reaction time is about 190 ms to light and 160 ms to sound, and the
 * signal takes 20–40 ms (light) or 8–10 ms (sound) to reach the brain (Jain 2015), so about 150 ms
 * pass after the brain gets the signal (deciding, the command down, the muscle). The brain route
 * adds it to the reflex's legs (model §2.6). Model estimate.
 */
import type { Widen } from '../params.ts'

/** The pages read for the demo (V-7), by key. Not in core/sources.ts: that registry is in the main entry. */
export const NERVE_SOURCES = {
  kiernan2003: {
    citation: 'Kiernan JA. Anatomical Foundations of Neuroscience: types of nerve fibres (table). University of Western Ontario, 2003.',
    url: 'https://publish.uwo.ca/~jkiernan/fibrtyp.htm',
  },
  byrneNeuroOnline: {
    citation:
      'Byrne JH. Neuroscience Online, ch. 3 (Propagation of the Action Potential) and ch. 6 (Synaptic Transmission in the CNS), §6.9. McGovern Medical School, UTHealth.',
    url: 'https://nba.uth.tmc.edu/neuroscience/m/s1/chapter06.html',
  },
  davisIuReflexes: {
    citation: 'Davis J, Cobb E, lucsmall. Basic Human Physiology: Reflexes. Indiana University Pressbooks (CC BY-NC-SA 4.0).',
    url: 'https://iu.pressbooks.pub/humanphys/?p=231',
  },
  khosrawi2018: {
    citation:
      'Khosrawi S, Vahdatpour B, Ahmadi M. Evaluation of relationship between extensor digitorum communis Hoffmann-reflex latency and upper limb length and age. Adv Biomed Res 2018;7:65.',
    url: 'https://doi.org/10.4103/abr.abr_106_17',
  },
  jain2015: {
    citation:
      'Jain A, Bansal R, Kumar A, Singh KD. A comparative study of visual and auditory reaction times on the basis of gender and physical activity levels of medical first year students. Int J Appl Basic Med Res 2015;5:124–127.',
    url: 'https://doi.org/10.4103/2229-516X.157168',
  },
  isoardo2026: {
    citation:
      'Isoardo G, Ardito RB, Ciullo S, Fontana E, et al. The relationship between emotion processing and flexor afferent responses in upper limbs. Sensors (Basel) 2026;26:557.',
    url: 'https://doi.org/10.3390/s26020557',
  },
  khatun2024: {
    citation:
      'Khatun Z, Kristinsdóttir S, Thórisdóttir AT, Halldórsdóttir LB, Tortorella F, Gargiulo P, Helgason T. Assessing neuromuscular system via patellar tendon reflex analysis using EMG in healthy individuals. Front Neurol 2024;15:1522121.',
    url: 'https://doi.org/10.3389/fneur.2024.1522121',
  },
} as const

export type NerveSourceId = keyof typeof NERVE_SOURCES

export const NERVE_PARAMS = {
  /** Conduction speeds, m/s (Kiernan's table). */
  fibreSpeedMPerS: {
    /**
     * Thick myelinated motor fibre (Aα, 70–120 m/s): the middle value.
     */
    aAlpha: 95,
    /**
     * Thin myelinated heat and pain fibre (Aδ, 10–30 m/s). Calibrated inside the range: the middle
     * value (20) puts the hot-pan reflex at 49.8 ms, below the measured onset of a spinal pain reflex
     * in the hand (70.8 ± 8.2 ms, Isoardo 2026); 15 m/s puts it at 64.3 ms.
     */
    aDelta: 15,
    /** Thin unmyelinated fibre (C, 0.5–2.5 m/s): the middle value. "Myelin off" uses it on every leg. */
    c: 1.5,
  },
  /** One chemical synapse, ms (Byrne ch. 6: usually about 0.5–1 ms; the low end). */
  synapseDelayMs: 0.5,
  /** Nerve to muscle, ms: a chemical synapse too, so Byrne's 0.5 ms (assumption). */
  nmjDelayMs: 0.5,
  /** What the route through the brain adds to the reflex, ms (derived from Jain 2015; see above). */
  thinkingMs: 150,
  /** Adult arm, m (Khosrawi 2018 means). */
  pathM: {
    /** Fingertip to the spinal cord: C7 spinous process to the tip of the third finger, 87.1 cm. */
    fingertipToCord: 0.871,
    /**
     * Spinal cord to the muscles that pull the hand back: C7 to the elbow (olecranon), 45.07 cm. The
     * upper-arm muscles lie along this stretch; using its full length is an approximation.
     */
    cordToArmMuscles: 0.4507,
  },
  /**
   * Knee jerk (patellar reflex) onset after the tap, ms: young adults 17.68 ± 3.708 (n 25, Khatun
   * 2024). Stored for the knee-tap scenario, which waits for a read source of the leg's path lengths.
   */
  kneeJerkMs: { mean: 17.68, sd: 3.708 },
} as const

export type NerveParams = Widen<typeof NERVE_PARAMS>
