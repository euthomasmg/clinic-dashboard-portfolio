export type UserProfile = {
  name: string;
  role: string;
  username: string;
  password: string;
  email: string;
  phone: string;
  document: string;
  address: UserProfileAddress;
  createdAt: string;
};

export type UserProfileAddress = {
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  zip_code: string;
};

export const emptyAddress: UserProfileAddress = {
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  zip_code: "",
};

export const mockUserProfile: UserProfile = {
  name: "",
  role: "",
  username: "",
  password: "Cl1nica@2024",
  email: "",
  phone: "",
  document: "",
  address: { ...emptyAddress },
  createdAt: "",
};
