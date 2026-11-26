CREATE TABLE inheritance_rooms (
  code TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  expires INTEGER NOT NULL
);
CREATE INDEX inheritance_rooms_owner_expiry ON inheritance_rooms(owner, expires);
CREATE INDEX inheritance_rooms_expiry ON inheritance_rooms(expires);
