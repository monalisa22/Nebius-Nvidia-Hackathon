import { id, passwordHash, type FamilyStore } from "./store";

export function createDemo(store: FamilyStore) {
  const primary = store.createFamily(
    {
      name: "Asha",
      familyName: "The Sharma family",
      email: `demo-${id()}@example.invalid`,
      password: id() + id(),
    },
    true,
  );
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const previousYear = Number(today.slice(0, 4)) - 1;
  const demoAnniversary = `${previousYear}-${today.slice(5)}`;
  store.run("INSERT INTO companion_preferences VALUES(?,?,?,?,?,?,?,?,?)", primary.id, 1, 21, 0, null, 3, now, 0, 1);
  const relatives = [
    {
      name: "Meera",
      relationship: "Daughter",
      about:
        "Lives in Bengaluru. Loves gardening and long Sunday conversations.",
      avatar: "/demo/meera.jpg",
    },
    {
      name: "Rohan",
      relationship: "Son",
      about: "Lives in Pune. Enjoys cooking and sharing family recipes.",
      avatar: "/demo/rohan.jpg",
    },
    {
      name: "Aarav",
      relationship: "Grandson",
      about: "Meera's son. Enjoys music and drawing.",
      avatar: "/demo/aarav.jpg",
    },
  ];
  const people = relatives.map((relative, i) => {
    const personId = id();
    const memberId = id();
    store.run(
      "INSERT INTO people VALUES(?,?,?,?,?,?)",
      personId,
      primary.family_id,
      relative.name,
      relative.relationship,
      relative.about,
      relative.avatar,
    );
    store.run(
      "INSERT INTO members(id,family_id,email,name,relationship,role,password_hash,can_schedule,person_id,created_at) VALUES(?,?,?,?,?,'relative',?,1,?,?)",
      memberId,
      primary.family_id,
      `demo-${id()}@example.invalid`,
      relative.name,
      relative.relationship,
      passwordHash(id() + id()),
      personId,
      now + i,
    );
    return { ...relative, id: personId, memberId };
  });
  const memories = [
    {
      title: `Diwali ${previousYear} at home`,
      caption:
        "We spent Diwali together, shared sweets, lit the house, and stayed up telling family stories. The photograph was added today so we could keep that evening close.",
      kind: "photo" as const,
      file: "family.jpg",
      people: [people[0].id, people[1].id, people[2].id],
      author: people[0].memberId,
      age: 5 * 60000,
      occurredOn: demoAnniversary,
    },
    {
      title: "A little music from Aarav",
      caption:
        "Aarav has started learning the guitar. He practised his first song this weekend and would love to tell you about it on our next call.",
      kind: "photo" as const,
      file: "family.jpg",
      people: [people[0].id, people[2].id],
      author: people[0].memberId,
      age: 3600000,
      occurredOn: null,
    },
    {
      title: "Sunday in the garden",
      caption:
        "The jasmine in Meera's balcony garden is flowering. She saved a photograph to share with you. She would like to hear about the plants you used to grow.",
      kind: "photo" as const,
      file: "garden.jpg",
      people: [people[0].id],
      author: people[0].memberId,
      age: 86400000,
      occurredOn: null,
    },
    {
      title: "A recipe worth keeping",
      caption:
        "Rohan made vegetable pulao on Sunday using the family recipe. He wants to ask you how you prepare the spice mixture.",
      kind: "story" as const,
      file: null,
      people: [people[1].id],
      author: people[1].memberId,
      age: 2 * 86400000,
      occurredOn: null,
    },
  ];
  for (const entry of memories) {
    const author = store.member(entry.author);
    let mediaId: string | null = null;
    if (entry.file) {
      mediaId = id();
      store.run(
        "INSERT INTO media VALUES(?,?,?,?,?,?,?)",
        mediaId,
        primary.family_id,
        author.id,
        "image/jpeg",
        `demo:${entry.file}`,
        0,
        now,
      );
    }
    const memoryId = store.addMemory(author, {
      title: entry.title,
      caption: entry.caption,
      kind: entry.kind,
      personIds: entry.people,
      audience: ["*"],
      mediaId,
    });
    store.reviewMemory(primary, memoryId, "approved", 1);
    if (entry.occurredOn) {
      store.run("INSERT INTO memory_context VALUES(?,?,?,?)", memoryId, entry.occurredOn, "Our home", 1);
      store.run(`INSERT INTO memory_anniversary_notices
        (id,member_id,source_id,event_on,anniversary_year,years_ago,created_at)
        VALUES(?,?,?,?,?,?,?)`, id(), primary.id, memoryId, entry.occurredOn, Number(today.slice(0, 4)), 1, now);
    }
    store.run(
      "UPDATE memories SET created_at=?,updated_at=? WHERE id=?",
      now - entry.age,
      now - entry.age,
      memoryId,
    );
  }
  store.addMemory(store.member(people[1].memberId), {
    title: "A visit next weekend",
    caption:
      "Rohan would like to visit next weekend. He will confirm the day with you before making plans.",
    kind: "update",
    personIds: [people[1].id],
    audience: ["*"],
  });
  store.scheduleCall(
    primary,
    people[0].id,
    now + 2 * 3600000,
    "A relaxed catch-up about the family.",
  );
  const messageId = store.createMessage(
    store.member(people[0].memberId),
    primary.id,
    "Hi Ma, thinking of you today. I will call this evening. Love, Meera.",
    null,
  );
  store.sendMessage(store.member(people[0].memberId), messageId, 1);
  return primary;
}
