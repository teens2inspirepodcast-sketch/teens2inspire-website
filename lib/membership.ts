export const membershipOptions = [
  { id: "personal", name: "Personal", price: "$7.99", cadence: "per month", profiles: "1 profile", description: "Your own space for inspiration, conversations, resources and more." },
  { id: "family", name: "Family", price: "$9.99", cadence: "per month", profiles: "3 profiles", description: "One membership with room for three profiles, including yours." },
  { id: "school", name: "School", price: "Free", cadence: "with a school code", profiles: "For your school community", description: "A school membership, made available with a code from your school." },
] as const;

export type MembershipTier = (typeof membershipOptions)[number]["id"];

export const membershipInterests = [
  "Inspiration", "Emunah", "Tefillah", "Jewish Life", "School", "Organization", "Friendship", "Teen Life",
  "Personal Growth", "Camp", "Creativity", "Books", "Podcasts", "Videos", "Events", "Practical Tips", "Tznius",
] as const;

export function isMembershipTier(value: unknown): value is MembershipTier {
  return value === "personal" || value === "family" || value === "school";
}

export function passwordRequirements(password: string) {
  return {
    length: password.length >= 8,
    number: /\d/.test(password),
    uppercase: /[A-Z]/.test(password),
  };
}

export function normalizeSchoolCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
