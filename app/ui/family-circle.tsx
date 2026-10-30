"use client";

import Link from "next/link";
import { ArrowUpRight, Heart } from "lucide-react";
import type { Person } from "@/lib/anubandh/types";
import { Avatar } from "./primitives";

export function FamilyCircle({
  people,
  selectedId,
  onSelect,
}: {
  people: Person[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <section className="family-circle" aria-label="Memories by person">
      <div className="family-circle-track">
        <button
          className="circle-person circle-everyone"
          aria-pressed={!selectedId}
          onClick={() => onSelect(null)}
        >
          <span className="circle-portrait">
            <Heart size={26} />
          </span>
          <span>Everyone</span>
        </button>
        {people.map((person, index) => (
          <button
            key={person.id}
            className={`circle-person circle-tone-${index % 3}`}
            aria-label={`Memories with ${person.name}`}
            aria-pressed={selectedId === person.id}
            onClick={() =>
              onSelect(selectedId === person.id ? null : person.id)
            }
          >
            <span className="circle-portrait">
              <Avatar src={person.avatar} name={person.name} />
            </span>
            <span>{person.name}</span>
          </button>
        ))}
        <Link href="/family" className="circle-person circle-more">
          <span className="circle-portrait">
            <ArrowUpRight size={25} />
          </span>
          <span>Your people</span>
        </Link>
      </div>
    </section>
  );
}
