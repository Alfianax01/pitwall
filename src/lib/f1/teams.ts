export interface TeamData {
  name: string;
  shortCode: string;
  color: string;
  logoSrc: string;
  carSrc: string;
  slug: string;
}

export const TEAMS_DATA: Record<string, TeamData> = {
  McLaren: {
    name: "McLaren",
    shortCode: "MCL",
    color: "#FF8000",
    logoSrc: "/teams/mclaren-logo.svg",
    carSrc: "/teams/mclaren-car.png",
    slug: "mclaren",
  },
  Ferrari: {
    name: "Ferrari",
    shortCode: "FER",
    color: "#E80020",
    logoSrc: "/teams/ferrari-logo.svg",
    carSrc: "/teams/ferrari-car.png",
    slug: "ferrari",
  },
  "Red Bull Racing": {
    name: "Red Bull Racing",
    shortCode: "RBR",
    color: "#3671C6",
    logoSrc: "/teams/red-bull-logo.svg",
    carSrc: "/teams/red-bull-car.png",
    slug: "red-bull",
  },
  "Red Bull": {
    name: "Red Bull Racing",
    shortCode: "RBR",
    color: "#3671C6",
    logoSrc: "/teams/red-bull-logo.svg",
    carSrc: "/teams/red-bull-car.png",
    slug: "red-bull",
  },
  Mercedes: {
    name: "Mercedes",
    shortCode: "MER",
    color: "#27F4D2",
    logoSrc: "/teams/mercedes-logo.svg",
    carSrc: "/teams/mercedes-car.png",
    slug: "mercedes",
  },
  "Aston Martin": {
    name: "Aston Martin",
    shortCode: "AMR",
    color: "#229971",
    logoSrc: "/teams/aston-martin-logo.svg",
    carSrc: "/teams/aston-martin-car.png",
    slug: "aston-martin",
  },
  Alpine: {
    name: "Alpine",
    shortCode: "ALP",
    color: "#0093CC",
    logoSrc: "/teams/alpine-logo.svg",
    carSrc: "/teams/alpine-car.png",
    slug: "alpine",
  },
  "Alpine F1 Team": {
    name: "Alpine",
    shortCode: "ALP",
    color: "#0093CC",
    logoSrc: "/teams/alpine-logo.svg",
    carSrc: "/teams/alpine-car.png",
    slug: "alpine",
  },
  Williams: {
    name: "Williams",
    shortCode: "WIL",
    color: "#64C4FF",
    logoSrc: "/teams/williams-logo.svg",
    carSrc: "/teams/williams-car.png",
    slug: "williams",
  },
  "Haas F1 Team": {
    name: "Haas F1 Team",
    shortCode: "HAA",
    color: "#B6BABD",
    logoSrc: "/teams/haas-logo.svg",
    carSrc: "/teams/haas-car.png",
    slug: "haas",
  },
  Haas: {
    name: "Haas F1 Team",
    shortCode: "HAA",
    color: "#B6BABD",
    logoSrc: "/teams/haas-logo.svg",
    carSrc: "/teams/haas-car.png",
    slug: "haas",
  },
  RB: {
    name: "Racing Bulls",
    shortCode: "RBF",
    color: "#6692FF",
    logoSrc: "/teams/rb-logo.svg",
    carSrc: "/teams/rb-car.png",
    slug: "rb",
  },
  "RB F1 Team": {
    name: "Racing Bulls",
    shortCode: "RBF",
    color: "#6692FF",
    logoSrc: "/teams/rb-logo.svg",
    carSrc: "/teams/rb-car.png",
    slug: "rb",
  },
  "Racing Bulls": {
    name: "Racing Bulls",
    shortCode: "RBF",
    color: "#6692FF",
    logoSrc: "/teams/rb-logo.svg",
    carSrc: "/teams/rb-car.png",
    slug: "rb",
  },
  "Kick Sauber": {
    name: "Kick Sauber",
    shortCode: "SAU",
    color: "#52E252",
    logoSrc: "/teams/sauber-logo.svg",
    carSrc: "/teams/sauber-car.png",
    slug: "sauber",
  },
  Sauber: {
    name: "Kick Sauber",
    shortCode: "SAU",
    color: "#52E252",
    logoSrc: "/teams/sauber-logo.svg",
    carSrc: "/teams/sauber-car.png",
    slug: "sauber",
  },
  Audi: {
    name: "Audi",
    shortCode: "AUD",
    color: "#F50537",
    logoSrc: "/teams/audi-logo.svg",
    carSrc: "/teams/audi-car.png",
    slug: "audi",
  },
  Cadillac: {
    name: "Cadillac",
    shortCode: "CAD",
    color: "#D4AF37",
    logoSrc: "/teams/cadillac-logo.svg",
    carSrc: "/teams/cadillac-car.png",
    slug: "cadillac",
  },
};

export function getTeamData(identifier: string | null | undefined): TeamData {
  if (!identifier) {
    return {
      name: "Formula 1 Team",
      shortCode: "F1",
      color: "#71717A",
      logoSrc: "",
      carSrc: "",
      slug: "f1",
    };
  }

  // Exact match
  if (TEAMS_DATA[identifier]) {
    return TEAMS_DATA[identifier];
  }

  const normalized = identifier.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const [key, val] of Object.entries(TEAMS_DATA)) {
    const keyNorm = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (keyNorm === normalized || normalized.includes(keyNorm) || keyNorm.includes(normalized)) {
      return val;
    }
    const slugNorm = val.slug.replace(/[^a-z0-9]/g, "");
    if (slugNorm === normalized || normalized.includes(slugNorm)) {
      return val;
    }
  }

  return {
    name: identifier,
    shortCode: identifier.slice(0, 3).toUpperCase(),
    color: "#71717A",
    logoSrc: "",
    carSrc: "",
    slug: identifier.toLowerCase().replace(/\s+/g, "-"),
  };
}

