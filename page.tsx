"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { defaultHomepage } from "@/lib/default-homepage";
import {
  HomepageFeature,
  HomepageJourneyStep,
  HomepageMethodStep,
  HomepageSettings,
} from "@/lib/cms";

type AnyRecord = Record<string, unknown>;

function mergeHomepage(
  saved: Partial<HomepageSettings>
): HomepageSettings {
  return {
    ...defaultHomepage,
    ...saved,

    global: {
      ...defaultHomepage.global,
      ...(saved.global || {}),
      heroChecklist:
        saved.global?.heroChecklist ||
        defaultHomepage.global.heroChecklist,
      problemCards:
        saved.global?.problemCards ||
        defaultHomepage.global.problemCards,
      cbtQuestionNumbers:
        saved.global?.cbtQuestionNumbers ||
        defaultHomepage.global.cbtQuestionNumbers,
    },

    announcement: {
      ...defaultHomepage.announcement,
      ...(saved.announcement || {}),
    },

    hero: {
      ...defaultHomepage.hero,
      ...(saved.hero || {}),
    },

    about: {
      ...defaultHomepage.about,
      ...(saved.about || {}),
      points:
        saved.about?.points || defaultHomepage.about.points,
    },

    method: {
      ...defaultHomepage.method,
      ...(saved.method || {}),
      steps:
        saved.method?.steps || defaultHomepage.method.steps,
    },

    features: {
      ...defaultHomepage.features,
      ...(saved.features || {}),
      items:
        saved.features?.items || defaultHomepage.features.items,
    },

    learning: {
      ...defaultHomepage.learning,
      ...(saved.learning || {}),
      bullets:
        saved.learning?.bullets || defaultHomepage.learning.bullets,
      subjects:
        saved.learning?.subjects || defaultHomepage.learning.subjects,
    },

    cbt: {
      ...defaultHomepage.cbt,
      ...(saved.cbt || {}),
      infoItems:
        saved.cbt?.infoItems || defaultHomepage.cbt.infoItems,
      answers:
        saved.cbt?.answers || defaultHomepage.cbt.answers,
    },

    battle: {
      ...defaultHomepage.battle,
      ...(saved.battle || {}),
      tags:
        saved.battle?.tags || defaultHomepage.battle.tags,
      players:
        saved.battle?.players || defaultHomepage.battle.players,
    },

    aiCoach: {
      ...defaultHomepage.aiCoach,
      ...(saved.aiCoach || {}),
      points:
        saved.aiCoach?.points || defaultHomepage.aiCoach.points,
    },

    analytics: {
      ...defaultHomepage.analytics,
      ...(saved.analytics || {}),
      points:
        saved.analytics?.points ||
        defaultHomepage.analytics.points,
      subjects:
        saved.analytics?.subjects ||
        defaultHomepage.analytics.subjects,
    },

    community: {
      ...defaultHomepage.community,
      ...(saved.community || {}),
    },

    tutors: {
      ...defaultHomepage.tutors,
      ...(saved.tutors || {}),
      features:
        saved.tutors?.features ||
        defaultHomepage.tutors.features,
    },

    journey: {
      ...defaultHomepage.journey,
      ...(saved.journey || {}),
      steps:
        saved.journey?.steps ||
        defaultHomepage.journey.steps,
    },

    mission: {
      ...defaultHomepage.mission,
      ...(saved.mission || {}),
    },

    finalCta: {
      ...defaultHomepage.finalCta,
      ...(saved.finalCta || {}),
    },

    footer: {
      ...defaultHomepage.footer,
      ...(saved.footer || {}),
    },
  };
}

/**
 * Images are owned by Media Manager.
 *
 * This removes image fields from the CMS save payload so that
 * clicking "Save Changes" here cannot accidentally overwrite
 * an image assignment made from /admin/media.
 */
function createCmsSavePayload(
  homepage: HomepageSettings
): AnyRecord {
  const payload = JSON.parse(
    JSON.stringify(homepage)
  ) as AnyRecord;

  const sectionsWithImages = [
    "hero",
    "about",
    "learning",
    "cbt",
    "battle",
    "aiCoach",
    "analytics",
    "community",
    "mission",
  ];

  for (const sectionName of sectionsWithImages) {
    const section = payload[sectionName];

    if (
      section &&
      typeof section === "object" &&
      !Array.isArray(section)
    ) {
      const sectionRecord = section as AnyRecord;

      delete sectionRecord.image;
      delete sectionRecord.imageMediaId;
      delete sectionRecord.images;
      delete sectionRecord.imageMediaIds;
    }
  }

  return payload;
}

export default function HomepageEditor() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [data, setData] =
    useState<HomepageSettings>(defaultHomepage);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace("/admin/login");
        return;
      }

      try {
        const adminSnapshot = await getDoc(
          doc(db, "adminUsers", currentUser.uid)
        );

        if (!adminSnapshot.exists() || adminSnapshot.data().active !== true) {
          await signOut(auth);
          router.replace("/admin/login?error=unauthorized");
          return;
        }

        setUser(currentUser);
        setCheckingAuth(false);
      } catch (error) {
        console.error("Homepage CMS authorization error:", error);
        await signOut(auth);
        router.replace("/admin/login?error=authorization");
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    async function loadHomepage() {
      try {
        const snapshot = await getDoc(
          doc(db, "siteSettings", "homepage")
        );

        if (snapshot.exists()) {
          const savedData =
            snapshot.data() as Partial<HomepageSettings>;

          setData(mergeHomepage(savedData));
        } else {
          setData(defaultHomepage);
        }
      } catch (err) {
        console.error(
          "Failed to load homepage:",
          err
        );

        setError(
          "Unable to load homepage settings."
        );
      } finally {
        setLoading(false);
      }
    }

    loadHomepage();
  }, []);

  async function saveHomepage() {
    setSaving(true);
    setSaved(false);
    setError("");
    setMessage("");

    try {
      const payload =
        createCmsSavePayload(data);

      await setDoc(
        doc(db, "siteSettings", "homepage"),
        payload,
        { merge: true }
      );

      setSaved(true);
      setMessage(
        "Homepage content saved successfully."
      );

      window.setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (err) {
      console.error(
        "Failed to save homepage:",
        err
      );

      setError(
        "Unable to save homepage. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function updateSection<
    T extends keyof HomepageSettings
  >(
    section: T,
    field: keyof HomepageSettings[T],
    value: unknown
  ) {
    setData((current) => ({
      ...current,
      [section]: {
        ...(current[section] as object),
        [field]: value,
      },
    }));
  }

  function updateAnnouncementItems(
    value: string
  ) {
    updateSection(
      "announcement",
      "items",
      value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }

  function updateNumber(
    section: "announcement" | "hero",
    field:
      | "rotationSeconds"
      | "imageRotationSeconds",
    value: number
  ) {
    const safeValue = Math.max(1, value);

    if (section === "announcement") {
      setData((current) => ({
        ...current,
        announcement: {
          ...current.announcement,
          rotationSeconds: safeValue,
        },
      }));

      return;
    }

    setData((current) => ({
      ...current,
      hero: {
        ...current.hero,
        imageRotationSeconds: safeValue,
      },
    }));
  }

  function updateBoolean(
    section: "announcement",
    field: "enabled",
    value: boolean
  ) {
    updateSection(
      section,
      field,
      value
    );
  }

  function updateArrayItem<T>(
    section: keyof HomepageSettings,
    field: string,
    index: number,
    value: T
  ) {
    setData((current) => {
      const sectionData =
        current[section] as AnyRecord;

      const array = Array.isArray(
        sectionData[field]
      )
        ? [...(sectionData[field] as T[])]
        : [];

      array[index] = value;

      return {
        ...current,
        [section]: {
          ...sectionData,
          [field]: array,
        },
      };
    });
  }

  function addArrayItem<T>(
    section: keyof HomepageSettings,
    field: string,
    item: T
  ) {
    setData((current) => {
      const sectionData =
        current[section] as AnyRecord;

      const array = Array.isArray(
        sectionData[field]
      )
        ? [...(sectionData[field] as T[])]
        : [];

      array.push(item);

      return {
        ...current,
        [section]: {
          ...sectionData,
          [field]: array,
        },
      };
    });
  }

  function removeArrayItem(
    section: keyof HomepageSettings,
    field: string,
    index: number
  ) {
    setData((current) => {
      const sectionData =
        current[section] as AnyRecord;

      const array = Array.isArray(
        sectionData[field]
      )
        ? [...(sectionData[field] as unknown[])]
        : [];

      array.splice(index, 1);

      return {
        ...current,
        [section]: {
          ...sectionData,
          [field]: array,
        },
      };
    });
  }

  function moveArrayItem(
    section: keyof HomepageSettings,
    field: string,
    index: number,
    direction: "up" | "down"
  ) {
    setData((current) => {
      const sectionData =
        current[section] as AnyRecord;

      const array = Array.isArray(
        sectionData[field]
      )
        ? [...(sectionData[field] as unknown[])]
        : [];

      const target =
        direction === "up"
          ? index - 1
          : index + 1;

      if (
        target < 0 ||
        target >= array.length
      ) {
        return current;
      }

      [array[index], array[target]] = [
        array[target],
        array[index],
      ];

      return {
        ...current,
        [section]: {
          ...sectionData,
          [field]: array,
        },
      };
    });
  }

  if (checkingAuth || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f5ff]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-700" />

          <p className="font-bold text-violet-700">
            Loading Homepage Editor...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5ff]">
      <header className="sticky top-0 z-50 border-b border-violet-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600 sm:text-xs">
              JAMBMASTER CMS
            </p>

            <h1 className="text-lg font-black text-gray-950 sm:text-2xl">
              Homepage Editor
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-semibold text-gray-500 sm:block">
              {user?.email}
            </span>

            <button
              type="button"
              onClick={() =>
                window.open(
                  "/",
                  "_blank"
                )
              }
              className="hidden rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-50 sm:block"
            >
              View Website
            </button>

            <button
              type="button"
              onClick={saveHomepage}
              disabled={saving}
              className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"
            >
              {saving
                ? "Saving..."
                : saved
                  ? "Saved ✓"
                  : "Save Changes"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-5 sm:py-8">
        {error && (
          <Notice
            type="error"
            message={error}
          />
        )}

        {message && (
          <Notice
            type="success"
            message={message}
          />
        )}

        <div className="rounded-3xl border border-violet-100 bg-gradient-to-r from-violet-700 to-purple-950 p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">
            Website Content Management
          </p>

          <h2 className="mt-2 text-2xl font-black sm:text-3xl">
            Control your entire homepage
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-violet-100">
            Edit the content displayed throughout
            JAMBMASTER. Changes are saved to Firestore
            and used by the public homepage.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <CmsBadge
              title="Content"
              text="Fully editable"
            />

            <CmsBadge
              title="Images"
              text="Media Manager"
            />

            <CmsBadge
              title="Storage"
              text="Firestore"
            />
          </div>
        </div>

        {/* GLOBAL CONTENT */}
        <EditorSection
          title="🌐 Global Homepage Content"
          description="Control the remaining visible homepage labels, navigation text, hero overlay copy and the dark reality section."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Input label="Navigation: About" value={data.global.navAbout} onChange={(value) => updateSection("global", "navAbout", value)} />
            <Input label="Navigation: Features" value={data.global.navFeatures} onChange={(value) => updateSection("global", "navFeatures", value)} />
            <Input label="Navigation: How It Works" value={data.global.navHowItWorks} onChange={(value) => updateSection("global", "navHowItWorks", value)} />
            <Input label="Navigation: Our Mission" value={data.global.navMission} onChange={(value) => updateSection("global", "navMission", value)} />
            <Input label="Navigation: Login" value={data.global.navLogin} onChange={(value) => updateSection("global", "navLogin", value)} />
            <Input label="Navigation: Start Free" value={data.global.navStartFree} onChange={(value) => updateSection("global", "navStartFree", value)} />
            <Input label="Navigation: Blog" value={data.global.navBlog} onChange={(value) => updateSection("global", "navBlog", value)} />
            <Input label="Navigation tagline" value={data.global.navTagline} onChange={(value) => updateSection("global", "navTagline", value)} />
            <Input label="Hero target score label" value={data.global.heroTargetScoreLabel} onChange={(value) => updateSection("global", "heroTargetScoreLabel", value)} />
            <Input label="Hero target score" value={data.global.heroTargetScore} onChange={(value) => updateSection("global", "heroTargetScore", value)} />
            <Input label="Hero battle label" value={data.global.heroBattleLabel} onChange={(value) => updateSection("global", "heroBattleLabel", value)} />
            <Input label="Hero battle title" value={data.global.heroBattleTitle} onChange={(value) => updateSection("global", "heroBattleTitle", value)} />
            <Input label="Hero caption label" value={data.global.heroCaptionLabel} onChange={(value) => updateSection("global", "heroCaptionLabel", value)} />
            <Input label="Hero caption title" value={data.global.heroCaptionTitle} onChange={(value) => updateSection("global", "heroCaptionTitle", value)} />
            <Input label="CBT live label" value={data.global.cbtLiveLabel} onChange={(value) => updateSection("global", "cbtLiveLabel", value)} />
            <Input label="Community avatar initial" value={data.global.communityAvatarInitial} onChange={(value) => updateSection("global", "communityAvatarInitial", value)} />
          </div>

          <ArrayTextEditor
            title="Hero checklist"
            items={data.global.heroChecklist}
            addLabel="Add item"
            onAdd={() => addArrayItem("global", "heroChecklist", "New item")}
            onChange={(index, value) => updateArrayItem("global", "heroChecklist", index, value)}
            onRemove={(index) => removeArrayItem("global", "heroChecklist", index)}
            onMoveUp={(index) => moveArrayItem("global", "heroChecklist", index, "up")}
            onMoveDown={(index) => moveArrayItem("global", "heroChecklist", index, "down")}
          />

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:p-5">
            <h3 className="font-black text-gray-900">Reality section</h3>
            <div className="mt-5 space-y-5">
              <Input label="Eyebrow" value={data.global.problemEyebrow} onChange={(value) => updateSection("global", "problemEyebrow", value)} />
              <Input label="Title" value={data.global.problemTitle} multiline onChange={(value) => updateSection("global", "problemTitle", value)} />
              <Input label="Description" value={data.global.problemDescription} multiline onChange={(value) => updateSection("global", "problemDescription", value)} />
            </div>
          </div>

          <RepeaterCard
            title="Reality cards"
            description="The three supporting cards displayed below the reality section."
            addLabel="Add card"
            onAdd={() => addArrayItem("global", "problemCards", { title: "New card", text: "Supporting text" })}
          >
            {data.global.problemCards.map((card, index) => (
              <ItemCard
                key={`${card.title}-${index}`}
                index={index}
                total={data.global.problemCards.length}
                onUp={() => moveArrayItem("global", "problemCards", index, "up")}
                onDown={() => moveArrayItem("global", "problemCards", index, "down")}
                onRemove={() => removeArrayItem("global", "problemCards", index)}
              >
                <Input label="Title" value={card.title} onChange={(value) => updateArrayItem("global", "problemCards", index, { ...card, title: value })} />
                <Input label="Text" value={card.text} onChange={(value) => updateArrayItem("global", "problemCards", index, { ...card, text: value })} />
              </ItemCard>
            ))}
          </RepeaterCard>

          <ArrayTextEditor
            title="CBT question map"
            items={data.global.cbtQuestionNumbers}
            addLabel="Add number"
            onAdd={() => addArrayItem("global", "cbtQuestionNumbers", "24")}
            onChange={(index, value) => updateArrayItem("global", "cbtQuestionNumbers", index, value)}
            onRemove={(index) => removeArrayItem("global", "cbtQuestionNumbers", index)}
            onMoveUp={(index) => moveArrayItem("global", "cbtQuestionNumbers", index, "up")}
            onMoveDown={(index) => moveArrayItem("global", "cbtQuestionNumbers", index, "down")}
          />
        </EditorSection>

        {/* ANNOUNCEMENT */}
        <EditorSection
          title="📢 Moving Announcement"
          description="Manage the rotating announcement bar displayed at the top of the website."
        >
          <Toggle
            label="Show announcement bar"
            value={
              data.announcement.enabled
            }
            onChange={(value) =>
              updateBoolean(
                "announcement",
                "enabled",
                value
              )
            }
          />

          <ArrayTextEditor
            title="Announcement messages"
            items={data.announcement.items}
            emptyText="No announcements added."
            addLabel="Add announcement"
            onAdd={() =>
              addArrayItem(
                "announcement",
                "items",
                "New announcement"
              )
            }
            onChange={(index, value) => {
              const items = [
                ...data.announcement.items,
              ];

              items[index] = value;

              updateSection(
                "announcement",
                "items",
                items
              );
            }}
            onRemove={(index) =>
              removeArrayItem(
                "announcement",
                "items",
                index
              )
            }
            onMoveUp={(index) =>
              moveArrayItem(
                "announcement",
                "items",
                index,
                "up"
              )
            }
            onMoveDown={(index) =>
              moveArrayItem(
                "announcement",
                "items",
                index,
                "down"
              )
            }
          />

          <NumberInput
            label="Rotation speed in seconds"
            value={
              data.announcement
                .rotationSeconds
            }
            min={1}
            max={60}
            onChange={(value) =>
              updateNumber(
                "announcement",
                "rotationSeconds",
                value
              )
            }
          />
        </EditorSection>

        {/* HERO */}
        <EditorSection
          title="🏆 Hero Section"
          description="Control the first impression visitors see when they enter JAMBMASTER."
        >
          <Input
            label="Eyebrow"
            value={data.hero.eyebrow}
            onChange={(value) =>
              updateSection(
                "hero",
                "eyebrow",
                value
              )
            }
          />

          <Input
            label="Main heading"
            value={data.hero.title}
            multiline
            onChange={(value) =>
              updateSection(
                "hero",
                "title",
                value
              )
            }
            help="Use line breaks if you want to control the heading layout."
          />

          <Input
            label="Description"
            value={data.hero.description}
            multiline
            onChange={(value) =>
              updateSection(
                "hero",
                "description",
                value
              )
            }
          />

          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Primary button text"
              value={
                data.hero
                  .primaryButtonText
              }
              onChange={(value) =>
                updateSection(
                  "hero",
                  "primaryButtonText",
                  value
                )
              }
            />

            <Input
              label="Primary button link"
              value={
                data.hero
                  .primaryButtonLink
              }
              onChange={(value) =>
                updateSection(
                  "hero",
                  "primaryButtonLink",
                  value
                )
              }
            />

            <Input
              label="Secondary button text"
              value={
                data.hero
                  .secondaryButtonText
              }
              onChange={(value) =>
                updateSection(
                  "hero",
                  "secondaryButtonText",
                  value
                )
              }
            />

            <Input
              label="Secondary button link"
              value={
                data.hero
                  .secondaryButtonLink
              }
              onChange={(value) =>
                updateSection(
                  "hero",
                  "secondaryButtonLink",
                  value
                )
              }
            />
          </div>

          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
            <p className="text-sm font-black text-violet-900">
              Hero images are managed by Media Manager
            </p>
            <p className="mt-1 text-xs leading-5 text-violet-700">
              Upload or replace Hero Image 1, 2 and 3 from the Media Manager. Saving this CMS page will never overwrite media assignments.
            </p>
            <button
              type="button"
              onClick={() => window.open("/admin/media", "_blank")}
              className="mt-3 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white hover:bg-violet-800"
            >
              Open Media Manager →
            </button>
          </div>

          <NumberInput
            label="Hero image rotation speed"
            value={
              data.hero
                .imageRotationSeconds
            }
            min={1}
            max={60}
            onChange={(value) =>
              updateNumber(
                "hero",
                "imageRotationSeconds",
                value
              )
            }
          />
        </EditorSection>

        {/* ABOUT */}
        <EditorSection
          title="ℹ️ About JAMBMASTER"
          description="Edit the About section and its four supporting points."
        >
          <Input
            label="Eyebrow"
            value={data.about.eyebrow}
            onChange={(value) =>
              updateSection(
                "about",
                "eyebrow",
                value
              )
            }
          />

          <Input
            label="Title"
            value={data.about.title}
            multiline
            onChange={(value) =>
              updateSection(
                "about",
                "title",
                value
              )
            }
          />

          <Input
            label="Description"
            value={
              data.about.description
            }
            multiline
            onChange={(value) =>
              updateSection(
                "about",
                "description",
                value
              )
            }
          />

          <Input
            label="Second description"
            value={
              data.about
                .secondDescription
            }
            multiline
            onChange={(value) =>
              updateSection(
                "about",
                "secondDescription",
                value
              )
            }
          />

          <RepeaterCard
            title="About points"
            description="Add the key reasons students should use JAMBMASTER."
            addLabel="Add point"
            onAdd={() =>
              addArrayItem(
                "about",
                "points",
                {
                  number: String(
                    data.about.points.length +
                      1
                  ).padStart(2, "0"),
                  title: "New point",
                  description:
                    "Describe this point.",
                }
              )
            }
          >
            {data.about.points.map(
              (point, index) => (
                <ItemCard
                  key={index}
                  index={index}
                  total={
                    data.about.points.length
                  }
                  onUp={() =>
                    moveArrayItem(
                      "about",
                      "points",
                      index,
                      "up"
                    )
                  }
                  onDown={() =>
                    moveArrayItem(
                      "about",
                      "points",
                      index,
                      "down"
                    )
                  }
                  onRemove={() =>
                    removeArrayItem(
                      "about",
                      "points",
                      index
                    )
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Input
                      label="Number"
                      value={
                        point.number
                      }
                      onChange={(value) =>
                        updateArrayItem(
                          "about",
                          "points",
                          index,
                          {
                            ...point,
                            number:
                              value,
                          }
                        )
                      }
                    />

                    <div className="sm:col-span-2">
                      <Input
                        label="Title"
                        value={
                          point.title
                        }
                        onChange={(
                          value
                        ) =>
                          updateArrayItem(
                            "about",
                            "points",
                            index,
                            {
                              ...point,
                              title:
                                value,
                            }
                          )
                        }
                      />
                    </div>
                  </div>

                  <Input
                    label="Description"
                    value={
                      point.description
                    }
                    multiline
                    onChange={(value) =>
                      updateArrayItem(
                        "about",
                        "points",
                        index,
                        {
                          ...point,
                          description:
                            value,
                        }
                      )
                    }
                  />
                </ItemCard>
              )
            )}
          </RepeaterCard>

          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Note label"
              value={
                data.about.noteLabel
              }
              onChange={(value) =>
                updateSection(
                  "about",
                  "noteLabel",
                  value
                )
              }
            />

            <Input
              label="Note title"
              value={
                data.about.noteTitle
              }
              onChange={(value) =>
                updateSection(
                  "about",
                  "noteTitle",
                  value
                )
              }
            />
          </div>
        </EditorSection>

        {/* METHOD */}
        <EditorSection
          title="🔄 JAMBMASTER Method"
          description="Manage the preparation process displayed on the homepage."
        >
          <BasicSectionFields
            eyebrow={data.method.eyebrow}
            title={data.method.title}
            description={
              data.method.description
            }
            onEyebrow={(value) =>
              updateSection(
                "method",
                "eyebrow",
                value
              )
            }
            onTitle={(value) =>
              updateSection(
                "method",
                "title",
                value
              )
            }
            onDescription={(value) =>
              updateSection(
                "method",
                "description",
                value
              )
            }
          />

          <RepeaterCard
            title="Method steps"
            description="Add, remove and reorder the preparation steps."
            addLabel="Add method step"
            onAdd={() =>
              addArrayItem<
                HomepageMethodStep
              >(
                "method",
                "steps",
                {
                  number: String(
                    data.method.steps.length +
                      1
                  ).padStart(2, "0"),
                  title: "New step",
                  text:
                    "Describe this step.",
                }
              )
            }
          >
            {data.method.steps.map(
              (step, index) => (
                <ItemCard
                  key={index}
                  index={index}
                  total={
                    data.method.steps.length
                  }
                  onUp={() =>
                    moveArrayItem(
                      "method",
                      "steps",
                      index,
                      "up"
                    )
                  }
                  onDown={() =>
                    moveArrayItem(
                      "method",
                      "steps",
                      index,
                      "down"
                    )
                  }
                  onRemove={() =>
                    removeArrayItem(
                      "method",
                      "steps",
                      index
                    )
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-4">
                    <Input
                      label="Number"
                      value={
                        step.number
                      }
                      onChange={(value) =>
                        updateArrayItem(
                          "method",
                          "steps",
                          index,
                          {
                            ...step,
                            number:
                              value,
                          }
                        )
                      }
                    />

                    <div className="sm:col-span-3">
                      <Input
                        label="Title"
                        value={
                          step.title
                        }
                        onChange={(
                          value
                        ) =>
                          updateArrayItem(
                            "method",
                            "steps",
                            index,
                            {
                              ...step,
                              title:
                                value,
                            }
                          )
                        }
                      />
                    </div>
                  </div>

                  <Input
                    label="Text"
                    value={step.text}
                    multiline
                    onChange={(value) =>
                      updateArrayItem(
                        "method",
                        "steps",
                        index,
                        {
                          ...step,
                          text: value,
                        }
                      )
                    }
                  />
                </ItemCard>
              )
            )}
          </RepeaterCard>
        </EditorSection>

        {/* FEATURES */}
        <EditorSection
          title="⭐ Features"
          description="Control every feature card displayed on the homepage."
        >
          <BasicSectionFields
            eyebrow={
              data.features.eyebrow
            }
            title={
              data.features.title
            }
            description={
              data.features.description
            }
            onEyebrow={(value) =>
              updateSection(
                "features",
                "eyebrow",
                value
              )
            }
            onTitle={(value) =>
              updateSection(
                "features",
                "title",
                value
              )
            }
            onDescription={(value) =>
              updateSection(
                "features",
                "description",
                value
              )
            }
          />

          <RepeaterCard
            title="Feature cards"
            description="Each item becomes a feature card on the public homepage."
            addLabel="Add feature"
            onAdd={() =>
              addArrayItem<
                HomepageFeature
              >(
                "features",
                "items",
                {
                  number: String(
                    data.features.items
                      .length + 1
                  ).padStart(2, "0"),
                  title:
                    "New feature",
                  description:
                    "Describe this feature.",
                  icon: "book",
                }
              )
            }
          >
            {data.features.items.map(
              (feature, index) => (
                <ItemCard
                  key={index}
                  index={index}
                  total={
                    data.features.items
                      .length
                  }
                  onUp={() =>
                    moveArrayItem(
                      "features",
                      "items",
                      index,
                      "up"
                    )
                  }
                  onDown={() =>
                    moveArrayItem(
                      "features",
                      "items",
                      index,
                      "down"
                    )
                  }
                  onRemove={() =>
                    removeArrayItem(
                      "features",
                      "items",
                      index
                    )
                  }
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <Input
                      label="Number"
                      value={
                        feature.number
                      }
                      onChange={(value) =>
                        updateArrayItem(
                          "features",
                          "items",
                          index,
                          {
                            ...feature,
                            number:
                              value,
                          }
                        )
                      }
                    />

                    <Input
                      label="Title"
                      value={
                        feature.title
                      }
                      onChange={(value) =>
                        updateArrayItem(
                          "features",
                          "items",
                          index,
                          {
                            ...feature,
                            title:
                              value,
                          }
                        )
                      }
                    />

                    <Input
                      label="Icon"
                      value={
                        feature.icon
                      }
                      onChange={(value) =>
                        updateArrayItem(
                          "features",
                          "items",
                          index,
                          {
                            ...feature,
                            icon:
                              value,
                          }
                        )
                      }
                      help="Example: book, monitor, swords, spark, chart, users."
                    />
                  </div>

                  <Input
                    label="Description"
                    value={
                      feature.description
                    }
                    multiline
                    onChange={(value) =>
                      updateArrayItem(
                        "features",
                        "items",
                        index,
                        {
                          ...feature,
                          description:
                            value,
                        }
                      )
                    }
                  />
                </ItemCard>
              )
            )}
          </RepeaterCard>
        </EditorSection>

        {/* LEARNING */}
        <EditorSection
          title="📚 Learning"
          description="Control the learning section, bullets and displayed subjects."
        >
          <BasicSectionFields
            eyebrow={
              data.learning.eyebrow
            }
            title={
              data.learning.title
            }
            description={
              data.learning.description
            }
            onEyebrow={(value) =>
              updateSection(
                "learning",
                "eyebrow",
                value
              )
            }
            onTitle={(value) =>
              updateSection(
                "learning",
                "title",
                value
              )
            }
            onDescription={(value) =>
              updateSection(
                "learning",
                "description",
                value
              )
            }
          />

          <ArrayTextEditor
            title="Learning bullets"
            items={data.learning.bullets}
            addLabel="Add learning bullet"
            onAdd={() =>
              addArrayItem(
                "learning",
                "bullets",
                "New learning point"
              )
            }
            onChange={(index, value) => {
              const items = [
                ...data.learning.bullets,
              ];
              items[index] = value;

              updateSection(
                "learning",
                "bullets",
                items
              );
            }}
            onRemove={(index) =>
              removeArrayItem(
                "learning",
                "bullets",
                index
              )
            }
            onMoveUp={(index) =>
              moveArrayItem(
                "learning",
                "bullets",
                index,
                "up"
              )
            }
            onMoveDown={(index) =>
              moveArrayItem(
                "learning",
                "bullets",
                index,
                "down"
              )
            }
          />

          <Input
            label="Subjects label"
            value={
              data.learning
                .subjectsLabel
            }
            onChange={(value) =>
              updateSection(
                "learning",
                "subjectsLabel",
                value
              )
            }
          />

          <ArrayTextEditor
            title="Subjects"
            items={data.learning.subjects}
            addLabel="Add subject"
            onAdd={() =>
              addArrayItem(
                "learning",
                "subjects",
                "New subject"
              )
            }
            onChange={(index, value) => {
              const items = [
                ...data.learning.subjects,
              ];
              items[index] = value;

              updateSection(
                "learning",
                "subjects",
                items
              );
            }}
            onRemove={(index) =>
              removeArrayItem(
                "learning",
                "subjects",
                index
              )
            }
            onMoveUp={(index) =>
              moveArrayItem(
                "learning",
                "subjects",
                index,
                "up"
              )
            }
            onMoveDown={(index) =>
              moveArrayItem(
                "learning",
                "subjects",
                index,
                "down"
              )
            }
          />
        </EditorSection>

        {/* CBT */}
        <EditorSection
          title="💻 CBT Practice"
          description="Control the CBT preview and supporting information displayed on the homepage."
        >
          <BasicSectionFields
            eyebrow={data.cbt.eyebrow}
            title={data.cbt.title}
            description={
              data.cbt.description
            }
            onEyebrow={(value) =>
              updateSection(
                "cbt",
                "eyebrow",
                value
              )
            }
            onTitle={(value) =>
              updateSection(
                "cbt",
                "title",
                value
              )
            }
            onDescription={(value) =>
              updateSection(
                "cbt",
                "description",
                value
              )
            }
          />

          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Preview title"
              value={
                data.cbt.previewTitle
              }
              onChange={(value) =>
                updateSection(
                  "cbt",
                  "previewTitle",
                  value
                )
              }
            />

            <Input
              label="Timer"
              value={data.cbt.timer}
              onChange={(value) =>
                updateSection(
                  "cbt",
                  "timer",
                  value
                )
              }
            />

            <Input
              label="Question label"
              value={
                data.cbt.questionLabel
              }
              onChange={(value) =>
                updateSection(
                  "cbt",
                  "questionLabel",
                  value
                )
              }
            />

            <NumberInput
              label="Selected answer"
              value={
                data.cbt.selectedAnswer
              }
              min={0}
              max={3}
              onChange={(value) =>
                updateSection(
                  "cbt",
                  "selectedAnswer",
                  value
                )
              }
            />
          </div>

          <Input
            label="Question"
            value={data.cbt.question}
            multiline
            onChange={(value) =>
              updateSection(
                "cbt",
                "question",
                value
              )
            }
          />

          <ArrayTextEditor
            title="CBT information items"
            items={data.cbt.infoItems.map(
              (item) => item.title
            )}
            addLabel="Add CBT information"
            onAdd={() =>
              addArrayItem(
                "cbt",
                "infoItems",
                {
                  title:
                    "New CBT feature",
                }
              )
            }
            onChange={(index, value) => {
              updateArrayItem(
                "cbt",
                "infoItems",
                index,
                {
                  title: value,
                }
              );
            }}
            onRemove={(index) =>
              removeArrayItem(
                "cbt",
                "infoItems",
                index
              )
            }
            onMoveUp={(index) =>
              moveArrayItem(
                "cbt",
                "infoItems",
                index,
                "up"
              )
            }
            onMoveDown={(index) =>
              moveArrayItem(
                "cbt",
                "infoItems",
                index,
                "down"
              )
            }
          />

          <ArrayTextEditor
            title="CBT answers"
            items={data.cbt.answers}
            addLabel="Add answer"
            onAdd={() =>
              addArrayItem(
                "cbt",
                "answers",
                "D. New option"
              )
            }
            onChange={(index, value) => {
              const answers = [
                ...data.cbt.answers,
              ];

              answers[index] = value;

              updateSection(
                "cbt",
                "answers",
                answers
              );
            }}
            onRemove={(index) =>
              removeArrayItem(
                "cbt",
                "answers",
                index
              )
            }
            onMoveUp={(index) =>
              moveArrayItem(
                "cbt",
                "answers",
                index,
                "up"
              )
            }
            onMoveDown={(index) =>
              moveArrayItem(
                "cbt",
                "answers",
                index,
                "down"
              )
            }
          />
        </EditorSection>

        {/* BATTLE */}
        <EditorSection
          title="⚔️ Battle Arena"
          description="Manage the competitive JAMB battle preview."
        >
          <BasicSectionFields
            eyebrow={
              data.battle.eyebrow
            }
            title={data.battle.title}
            description={
              data.battle.description
            }
            onEyebrow={(value) =>
              updateSection(
                "battle",
                "eyebrow",
                value
              )
            }
            onTitle={(value) =>
              updateSection(
                "battle",
                "title",
                value
              )
            }
            onDescription={(value) =>
              updateSection(
                "battle",
                "description",
                value
              )
            }
          />

          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Board label"
              value={
                data.battle.boardLabel
              }
              onChange={(value) =>
                updateSection(
                  "battle",
                  "boardLabel",
                  value
                )
              }
            />

            <Input
              label="Board title"
              value={
                data.battle.boardTitle
              }
              onChange={(value) =>
                updateSection(
                  "battle",
                  "boardTitle",
                  value
                )
              }
            />

            <Input
              label="Board footer"
              value={
                data.battle.boardFooter
              }
              onChange={(value) =>
                updateSection(
                  "battle",
                  "boardFooter",
                  value
                )
              }
            />
          </div>

          <ArrayTextEditor
            title="Battle tags"
            items={data.battle.tags}
            addLabel="Add battle tag"
            onAdd={() =>
              addArrayItem(
                "battle",
                "tags",
                "New tag"
              )
            }
            onChange={(index, value) => {
              const tags = [
                ...data.battle.tags,
              ];

              tags[index] = value;

              updateSection(
                "battle",
                "tags",
                tags
              );
            }}
            onRemove={(index) =>
              removeArrayItem(
                "battle",
                "tags",
                index
              )
            }
            onMoveUp={(index) =>
              moveArrayItem(
                "battle",
                "tags",
                index,
                "up"
              )
            }
            onMoveDown={(index) =>
              moveArrayItem(
                "battle",
                "tags",
                index,
                "down"
              )
            }
          />

          <RepeaterCard
            title="Battle players"
            description="Control the sample leaderboard displayed on the homepage."
            addLabel="Add player"
            onAdd={() =>
              addArrayItem(
                "battle",
                "players",
                {
                  position:
                    String(
                      data.battle.players
                        .length + 1
                    ).padStart(2, "0"),
                  name:
                    "New Player",
                  score: "250",
                  active: false,
                }
              )
            }
          >
            {data.battle.players.map(
              (player, index) => (
                <ItemCard
                  key={index}
                  index={index}
                  total={
                    data.battle.players
                      .length
                  }
                  onUp={() =>
                    moveArrayItem(
                      "battle",
                      "players",
                      index,
                      "up"
                    )
                  }
                  onDown={() =>
                    moveArrayItem(
                      "battle",
                      "players",
                      index,
                      "down"
                    )
                  }
                  onRemove={() =>
                    removeArrayItem(
                      "battle",
                      "players",
                      index
                    )
                  }
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <Input
                      label="Position"
                      value={
                        player.position
                      }
                      onChange={(value) =>
                        updateArrayItem(
                          "battle",
                          "players",
                          index,
                          {
                            ...player,
                            position:
                              value,
                          }
                        )
                      }
                    />

                    <Input
                      label="Name"
                      value={
                        player.name
                      }
                      onChange={(value) =>
                        updateArrayItem(
                          "battle",
                          "players",
                          index,
                          {
                            ...player,
                            name:
                              value,
                          }
                        )
                      }
                    />

                    <Input
                      label="Score"
                      value={
                        player.score
                      }
                      onChange={(value) =>
                        updateArrayItem(
                          "battle",
                          "players",
                          index,
                          {
                            ...player,
                            score:
                              value,
                          }
                        )
                      }
                    />
                  </div>

                  <Toggle
                    label="Highlight this player"
                    value={
                      player.active ===
                      true
                    }
                    onChange={(value) =>
                      updateArrayItem(
                        "battle",
                        "players",
                        index,
                        {
                          ...player,
                          active:
                            value,
                        }
                      )
                    }
                  />
                </ItemCard>
              )
            )}
          </RepeaterCard>
        </EditorSection>

        {/* AI */}
        <EditorSection
          title="🤖 AI JAMB Coach"
          description="Control the AI Coach messaging and demonstration displayed on the homepage."
        >
          <BasicSectionFields
            eyebrow={
              data.aiCoach.eyebrow
            }
            title={
              data.aiCoach.title
            }
            description={
              data.aiCoach.description
            }
            onEyebrow={(value) =>
              updateSection(
                "aiCoach",
                "eyebrow",
                value
              )
            }
            onTitle={(value) =>
              updateSection(
                "aiCoach",
                "title",
                value
              )
            }
            onDescription={(value) =>
              updateSection(
                "aiCoach",
                "description",
                value
              )
            }
          />

          <RepeaterCard
            title="AI Coach capabilities"
            description="Control the capability points shown beside the AI Coach."
            addLabel="Add AI point"
            onAdd={() =>
              addArrayItem(
                "aiCoach",
                "points",
                {
                  text:
                    "New AI capability",
                }
              )
            }
          >
            {data.aiCoach.points.map(
              (point, index) => (
                <ItemCard
                  key={index}
                  index={index}
                  total={
                    data.aiCoach.points
                      .length
                  }
                  onUp={() =>
                    moveArrayItem(
                      "aiCoach",
                      "points",
                      index,
                      "up"
                    )
                  }
                  onDown={() =>
                    moveArrayItem(
                      "aiCoach",
                      "points",
                      index,
                      "down"
                    )
                  }
                  onRemove={() =>
                    removeArrayItem(
                      "aiCoach",
                      "points",
                      index
                    )
                  }
                >
                  <Input
                    label="Capability"
                    value={point.text}
                    onChange={(value) =>
                      updateArrayItem(
                        "aiCoach",
                        "points",
                        index,
                        {
                          text: value,
                        }
                      )
                    }
                  />
                </ItemCard>
              )
            )}
          </RepeaterCard>

          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Assistant name"
              value={
                data.aiCoach
                  .assistantName
              }
              onChange={(value) =>
                updateSection(
                  "aiCoach",
                  "assistantName",
                  value
                )
              }
            />

            <Input
              label="Assistant subtitle"
              value={
                data.aiCoach
                  .assistantSubtitle
              }
              onChange={(value) =>
                updateSection(
                  "aiCoach",
                  "assistantSubtitle",
                  value
                )
              }
            />
          </div>

          <Input
            label="Student message"
            value={
              data.aiCoach
                .studentMessage
            }
            multiline
            onChange={(value) =>
              updateSection(
                "aiCoach",
                "studentMessage",
                value
              )
            }
          />

          <Input
            label="Assistant message"
            value={
              data.aiCoach
                .assistantMessage
            }
            multiline
            onChange={(value) =>
              updateSection(
                "aiCoach",
                "assistantMessage",
                value
              )
            }
          />

          <Input
            label="Input placeholder"
            value={
              data.aiCoach
                .inputPlaceholder
            }
            onChange={(value) =>
              updateSection(
                "aiCoach",
                "inputPlaceholder",
                value
              )
            }
          />
        </EditorSection>

        {/* ANALYTICS */}
        <EditorSection
          title="📊 Analytics"
          description="Control the performance analytics demonstration displayed on the homepage."
        >
          <BasicSectionFields
            eyebrow={
              data.analytics.eyebrow
            }
            title={
              data.analytics.title
            }
            description={
              data.analytics.description
            }
            onEyebrow={(value) =>
              updateSection(
                "analytics",
                "eyebrow",
                value
              )
            }
            onTitle={(value) =>
              updateSection(
                "analytics",
                "title",
                value
              )
            }
            onDescription={(value) =>
              updateSection(
                "analytics",
                "description",
                value
              )
            }
          />

          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Performance label"
              value={
                data.analytics
                  .performanceLabel
              }
              onChange={(value) =>
                updateSection(
                  "analytics",
                  "performanceLabel",
                  value
                )
              }
            />

            <Input
              label="Performance title"
              value={
                data.analytics
                  .performanceTitle
              }
              onChange={(value) =>
                updateSection(
                  "analytics",
                  "performanceTitle",
                  value
                )
              }
            />

            <Input
              label="Score"
              value={
                data.analytics.score
              }
              onChange={(value) =>
                updateSection(
                  "analytics",
                  "score",
                  value
                )
              }
            />

            <Input
              label="Score label"
              value={
                data.analytics
                  .scoreLabel
              }
              onChange={(value) =>
                updateSection(
                  "analytics",
                  "scoreLabel",
                  value
                )
              }
            />
          </div>

          <RepeaterCard
            title="Analytics points"
            description="Explain the key benefits of performance analytics."
            addLabel="Add analytics point"
            onAdd={() =>
              addArrayItem(
                "analytics",
                "points",
                {
                  title:
                    "New analytics point",
                  text:
                    "Describe this point.",
                }
              )
            }
          >
            {data.analytics.points.map(
              (point, index) => (
                <ItemCard
                  key={index}
                  index={index}
                  total={
                    data.analytics
                      .points.length
                  }
                  onUp={() =>
                    moveArrayItem(
                      "analytics",
                      "points",
                      index,
                      "up"
                    )
                  }
                  onDown={() =>
                    moveArrayItem(
                      "analytics",
                      "points",
                      index,
                      "down"
                    )
                  }
                  onRemove={() =>
                    removeArrayItem(
                      "analytics",
                      "points",
                      index
                    )
                  }
                >
                  <Input
                    label="Title"
                    value={
                      point.title
                    }
                    onChange={(value) =>
                      updateArrayItem(
                        "analytics",
                        "points",
                        index,
                        {
                          ...point,
                          title:
                            value,
                        }
                      )
                    }
                  />

                  <Input
                    label="Description"
                    value={
                      point.text
                    }
                    multiline
                    onChange={(value) =>
                      updateArrayItem(
                        "analytics",
                        "points",
                        index,
                        {
                          ...point,
                          text: value,
                        }
                      )
                    }
                  />
                </ItemCard>
              )
            )}
          </RepeaterCard>

          <RepeaterCard
            title="Subject performance bars"
            description="Control the sample subject percentages shown in the analytics preview."
            addLabel="Add subject"
            onAdd={() =>
              addArrayItem(
                "analytics",
                "subjects",
                {
                  name: "New Subject",
                  value: "50%",
                  width: "50%",
                }
              )
            }
          >
            {data.analytics.subjects.map(
              (subject, index) => (
                <ItemCard
                  key={index}
                  index={index}
                  total={
                    data.analytics
                      .subjects.length
                  }
                  onUp={() =>
                    moveArrayItem(
                      "analytics",
                      "subjects",
                      index,
                      "up"
                    )
                  }
                  onDown={() =>
                    moveArrayItem(
                      "analytics",
                      "subjects",
                      index,
                      "down"
                    )
                  }
                  onRemove={() =>
                    removeArrayItem(
                      "analytics",
                      "subjects",
                      index
                    )
                  }
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <Input
                      label="Subject"
                      value={
                        subject.name
                      }
                      onChange={(value) =>
                        updateArrayItem(
                          "analytics",
                          "subjects",
                          index,
                          {
                            ...subject,
                            name:
                              value,
                          }
                        )
                      }
                    />

                    <Input
                      label="Displayed value"
                      value={
                        subject.value
                      }
                      onChange={(value) =>
                        updateArrayItem(
                          "analytics",
                          "subjects",
                          index,
                          {
                            ...subject,
                            value:
                              value,
                          }
                        )
                      }
                    />

                    <Input
                      label="Bar width"
                      value={
                        subject.width
                      }
                      onChange={(value) =>
                        updateArrayItem(
                          "analytics",
                          "subjects",
                          index,
                          {
                            ...subject,
                            width:
                              value,
                          }
                        )
                      }
                      help="Example: 82%"
                    />
                  </div>
                </ItemCard>
              )
            )}
          </RepeaterCard>
        </EditorSection>

        {/* COMMUNITY */}
        <EditorSection
          title="👥 Community"
          description="Control the sample community post displayed on the homepage."
        >
          <BasicSectionFields
            eyebrow={
              data.community.eyebrow
            }
            title={
              data.community.title
            }
            description={
              data.community.description
            }
            onEyebrow={(value) =>
              updateSection(
                "community",
                "eyebrow",
                value
              )
            }
            onTitle={(value) =>
              updateSection(
                "community",
                "title",
                value
              )
            }
            onDescription={(value) =>
              updateSection(
                "community",
                "description",
                value
              )
            }
          />

          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Sample student name"
              value={
                data.community
                  .sampleName
              }
              onChange={(value) =>
                updateSection(
                  "community",
                  "sampleName",
                  value
                )
              }
            />

            <Input
              label="Encourage button"
              value={
                data.community
                  .encourageLabel
              }
              onChange={(value) =>
                updateSection(
                  "community",
                  "encourageLabel",
                  value
                )
              }
            />

            <Input
              label="Challenge button"
              value={
                data.community
                  .challengeLabel
              }
              onChange={(value) =>
                updateSection(
                  "community",
                  "challengeLabel",
                  value
                )
              }
            />
          </div>

          <Input
            label="Sample message"
            value={
              data.community
                .sampleMessage
            }
            multiline
            onChange={(value) =>
              updateSection(
                "community",
                "sampleMessage",
                value
              )
            }
          />
        </EditorSection>

        {/* TUTORS */}
        <EditorSection
          title="👨‍🏫 Tutors & Live Learning"
          description="Manage the tutor marketplace introduction displayed on the homepage."
        >
          <BasicSectionFields
            eyebrow={
              data.tutors.eyebrow
            }
            title={
              data.tutors.title
            }
            description={
              data.tutors.description
            }
            onEyebrow={(value) =>
              updateSection(
                "tutors",
                "eyebrow",
                value
              )
            }
            onTitle={(value) =>
              updateSection(
                "tutors",
                "title",
                value
              )
            }
            onDescription={(value) =>
              updateSection(
                "tutors",
                "description",
                value
              )
            }
          />

          <ArrayTextEditor
            title="Tutor features"
            items={data.tutors.features.map(
              (feature) => feature.text
            )}
            addLabel="Add tutor feature"
            onAdd={() =>
              addArrayItem(
                "tutors",
                "features",
                {
                  text:
                    "New tutor feature",
                }
              )
            }
            onChange={(index, value) =>
              updateArrayItem(
                "tutors",
                "features",
                index,
                {
                  text: value,
                }
              )
            }
            onRemove={(index) =>
              removeArrayItem(
                "tutors",
                "features",
                index
              )
            }
            onMoveUp={(index) =>
              moveArrayItem(
                "tutors",
                "features",
                index,
                "up"
              )
            }
            onMoveDown={(index) =>
              moveArrayItem(
                "tutors",
                "features",
                index,
                "down"
              )
            }
          />
        </EditorSection>

        {/* JOURNEY */}
        <EditorSection
          title="🧭 Student Journey"
          description="Control every stage of the JAMBMASTER preparation journey."
        >
          <BasicSectionFields
            eyebrow={
              data.journey.eyebrow
            }
            title={
              data.journey.title
            }
            description={
              data.journey.description
            }
            onEyebrow={(value) =>
              updateSection(
                "journey",
                "eyebrow",
                value
              )
            }
            onTitle={(value) =>
              updateSection(
                "journey",
                "title",
                value
              )
            }
            onDescription={(value) =>
              updateSection(
                "journey",
                "description",
                value
              )
            }
          />

          <RepeaterCard
            title="Journey steps"
            description="Add, remove and reorder the student's preparation journey."
            addLabel="Add journey step"
            onAdd={() =>
              addArrayItem<
                HomepageJourneyStep
              >(
                "journey",
                "steps",
                {
                  number: String(
                    data.journey.steps
                      .length + 1
                  ).padStart(2, "0"),
                  title:
                    "New journey step",
                  text:
                    "Describe this step.",
                }
              )
            }
          >
            {data.journey.steps.map(
              (step, index) => (
                <ItemCard
                  key={index}
                  index={index}
                  total={
                    data.journey.steps
                      .length
                  }
                  onUp={() =>
                    moveArrayItem(
                      "journey",
                      "steps",
                      index,
                      "up"
                    )
                  }
                  onDown={() =>
                    moveArrayItem(
                      "journey",
                      "steps",
                      index,
                      "down"
                    )
                  }
                  onRemove={() =>
                    removeArrayItem(
                      "journey",
                      "steps",
                      index
                    )
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-4">
                    <Input
                      label="Number"
                      value={
                        step.number
                      }
                      onChange={(value) =>
                        updateArrayItem(
                          "journey",
                          "steps",
                          index,
                          {
                            ...step,
                            number:
                              value,
                          }
                        )
                      }
                    />

                    <div className="sm:col-span-3">
                      <Input
                        label="Title"
                        value={
                          step.title
                        }
                        onChange={(
                          value
                        ) =>
                          updateArrayItem(
                            "journey",
                            "steps",
                            index,
                            {
                              ...step,
                              title:
                                value,
                            }
                          )
                        }
                      />
                    </div>
                  </div>

                  <Input
                    label="Description"
                    value={step.text}
                    multiline
                    onChange={(value) =>
                      updateArrayItem(
                        "journey",
                        "steps",
                        index,
                        {
                          ...step,
                          text: value,
                        }
                      )
                    }
                  />
                </ItemCard>
              )
            )}
          </RepeaterCard>
        </EditorSection>

        {/* MISSION */}
        <EditorSection
          title="🎯 Mission"
          description="Control the mission section of the homepage."
        >
          <BasicSectionFields
            eyebrow={
              data.mission.eyebrow
            }
            title={
              data.mission.title
            }
            description={
              data.mission.description
            }
            onEyebrow={(value) =>
              updateSection(
                "mission",
                "eyebrow",
                value
              )
            }
            onTitle={(value) =>
              updateSection(
                "mission",
                "title",
                value
              )
            }
            onDescription={(value) =>
              updateSection(
                "mission",
                "description",
                value
              )
            }
          />

          <Input
            label="Mission badge"
            value={data.mission.badge}
            multiline
            onChange={(value) =>
              updateSection(
                "mission",
                "badge",
                value
              )
            }
          />
        </EditorSection>

        {/* FINAL CTA */}
        <EditorSection
          title="🚀 Final Call To Action"
          description="Control the final conversion section before the footer."
        >
          <Input
            label="Eyebrow"
            value={
              data.finalCta.eyebrow
            }
            onChange={(value) =>
              updateSection(
                "finalCta",
                "eyebrow",
                value
              )
            }
          />

          <Input
            label="Title"
            value={
              data.finalCta.title
            }
            multiline
            onChange={(value) =>
              updateSection(
                "finalCta",
                "title",
                value
              )
            }
          />

          <Input
            label="Description"
            value={
              data.finalCta.description
            }
            multiline
            onChange={(value) =>
              updateSection(
                "finalCta",
                "description",
                value
              )
            }
          />

          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Button text"
              value={
                data.finalCta.buttonText
              }
              onChange={(value) =>
                updateSection(
                  "finalCta",
                  "buttonText",
                  value
                )
              }
            />

            <Input
              label="Button link"
              value={
                data.finalCta.buttonLink
              }
              onChange={(value) =>
                updateSection(
                  "finalCta",
                  "buttonLink",
                  value
                )
              }
            />
          </div>
        </EditorSection>

        {/* FOOTER */}
        <EditorSection
          title="🔻 Footer"
          description="Manage the main footer information."
        >
          <Input
            label="Footer description"
            value={
              data.footer.description
            }
            multiline
            onChange={(value) =>
              updateSection(
                "footer",
                "description",
                value
              )
            }
          />

          <Input
            label="Managed by"
            value={
              data.footer.managedBy
            }
            onChange={(value) =>
              updateSection(
                "footer",
                "managedBy",
                value
              )
            }
          />

          <Input
            label="Copyright"
            value={
              data.footer.copyright
            }
            onChange={(value) =>
              updateSection(
                "footer",
                "copyright",
                value
              )
            }
          />
        </EditorSection>

        <div className="rounded-3xl border border-green-100 bg-green-50 p-6">
          <p className="font-black text-green-900">
            Homepage CMS is ready
          </p>

          <p className="mt-2 text-sm leading-6 text-green-700">
            Text, repeatable content and homepage
            settings are managed here. Website images
            remain controlled by the Media Manager.
          </p>

          <button
            type="button"
            onClick={saveHomepage}
            disabled={saving}
            className="mt-5 rounded-xl bg-green-700 px-5 py-3 text-sm font-black text-white transition hover:bg-green-800 disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : "Save Homepage Changes"}
          </button>
        </div>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Reusable UI                                                                */
/* -------------------------------------------------------------------------- */

function BasicSectionFields({
  eyebrow,
  title,
  description,
  onEyebrow,
  onTitle,
  onDescription,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onEyebrow: (value: string) => void;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
}) {
  return (
    <>
      <Input
        label="Eyebrow"
        value={eyebrow}
        onChange={onEyebrow}
      />

      <Input
        label="Title"
        value={title}
        multiline
        onChange={onTitle}
      />

      <Input
        label="Description"
        value={description}
        multiline
        onChange={onDescription}
      />
    </>
  );
}

function EditorSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-7">
        <h2 className="text-xl font-black text-gray-950 sm:text-2xl">
          {title}
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
          {description}
        </p>
      </div>

      <div className="space-y-6">
        {children}
      </div>
    </section>
  );
}

function RepeaterCard({
  title,
  description,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  description: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:p-5">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-black text-gray-900">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-gray-500">
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-800"
        >
          + {addLabel}
        </button>
      </div>

      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function ItemCard({
  index,
  total,
  onUp,
  onDown,
  onRemove,
  children,
}: {
  index: number;
  total: number;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-700">
            Item {index + 1}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <SmallButton
            onClick={onUp}
            disabled={index === 0}
          >
            ↑
          </SmallButton>

          <SmallButton
            onClick={onDown}
            disabled={index === total - 1}
          >
            ↓
          </SmallButton>

          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {children}
      </div>
    </div>
  );
}

function ArrayTextEditor({
  title,
  items,
  addLabel,
  emptyText = "No items added yet.",
  onAdd,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  title: string;
  items: string[];
  addLabel: string;
  emptyText?: string;
  onAdd: () => void;
  onChange: (
    index: number,
    value: string
  ) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:p-5">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-black text-gray-900">
            {title}
          </h3>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-800"
        >
          + {addLabel}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-5 text-sm text-gray-500">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center"
            >
              <div className="flex-1">
                <input
                  value={item}
                  onChange={(event) =>
                    onChange(
                      index,
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-violet-600 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />
              </div>

              <div className="flex gap-2">
                <SmallButton
                  onClick={() =>
                    onMoveUp(index)
                  }
                  disabled={index === 0}
                >
                  ↑
                </SmallButton>

                <SmallButton
                  onClick={() =>
                    onMoveDown(index)
                  }
                  disabled={
                    index === items.length - 1
                  }
                >
                  ↓
                </SmallButton>

                <button
                  type="button"
                  onClick={() =>
                    onRemove(index)
                  }
                  className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  multiline = false,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  help?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-gray-800">
        {label}
      </label>

      {multiline ? (
        <textarea
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          rows={5}
          className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-900 outline-none transition focus:border-violet-600 focus:bg-white focus:ring-4 focus:ring-violet-100"
        />
      ) : (
        <input
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-violet-600 focus:bg-white focus:ring-4 focus:ring-violet-100"
        />
      )}

      {help && (
        <p className="mt-2 text-xs leading-5 text-gray-400">
          {help}
        </p>
      )}
    </div>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-gray-800">
        {label}
      </label>

      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const parsed =
            Number(event.target.value);

          if (
            Number.isNaN(parsed)
          ) {
            return;
          }

          onChange(
            Math.min(
              max,
              Math.max(min, parsed)
            )
          );
        }}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-violet-600 focus:bg-white focus:ring-4 focus:ring-violet-100"
      />
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
      <span className="text-sm font-black text-gray-800">
        {label}
      </span>

      <button
        type="button"
        onClick={() =>
          onChange(!value)
        }
        aria-label={label}
        aria-pressed={value}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          value
            ? "bg-violet-700"
            : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
            value
              ? "left-6"
              : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Notice({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  const success =
    type === "success";

  return (
    <div
      className={`rounded-2xl border px-5 py-4 text-sm font-bold ${
        success
          ? "border-green-100 bg-green-50 text-green-700"
          : "border-red-100 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}

function CmsBadge({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wider text-violet-200">
        {title}
      </p>

      <p className="mt-1 text-sm font-bold text-white">
        {text}
      </p>
    </div>
  );
}
