import { integer, primaryKey, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const entities = sqliteTable('planner_entities', {
  owner: text('owner').notNull(), id: text('id').notNull(), kind: text('kind').notNull(),
  data: text('data').notNull(), version: integer('version').notNull().default(1),
  updatedAt: text('updated_at').notNull(), lastOp: text('last_op').notNull(),
}, t => [primaryKey({ columns: [t.owner, t.id] })]);
export const receipts = sqliteTable('planner_receipts', {
  owner: text('owner').notNull(), opId: text('op_id').notNull(), at: text('at').notNull(),
}, t => [primaryKey({ columns: [t.owner, t.opId] })]);
export const history = sqliteTable('planner_history', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), entityId: text('entity_id').notNull(),
  kind: text('kind').notNull(), before: text('before_data'), after: text('after_data').notNull(),
  at: text('at').notNull(), source: text('source').notNull(),
}, t => [index('planner_history_owner').on(t.owner, t.entityId)]);
export const telegramLinks = sqliteTable('planner_telegram', {
  owner: text('owner').primaryKey(), chatId: text('chat_id'), linkCode: text('link_code'),
  linkExpires: text('link_expires'), lastUpdate: integer('last_update').notNull().default(0),
  lockedUntil: integer('locked_until').notNull().default(0),
});
export const telegramDrafts=sqliteTable('planner_telegram_drafts',{
 owner:text('owner').notNull(),id:text('id').notNull(),payload:text('payload').notNull(),applied:integer('applied').notNull().default(0),at:text('at').notNull(),
},t=>[primaryKey({columns:[t.owner,t.id]})]);

export const user=sqliteTable('user',{
 id:text('id').primaryKey(),name:text('name').notNull(),email:text('email').notNull().unique(),emailVerified:integer('email_verified',{mode:'boolean'}).notNull().default(false),image:text('image'),createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),
});
export const session=sqliteTable('session',{
 id:text('id').primaryKey(),token:text('token').notNull().unique(),expiresAt:integer('expires_at',{mode:'timestamp_ms'}).notNull(),createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),ipAddress:text('ip_address'),userAgent:text('user_agent'),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
},t=>[index('session_user_idx').on(t.userId)]);
export const account=sqliteTable('account',{
 id:text('id').primaryKey(),accountId:text('account_id').notNull(),providerId:text('provider_id').notNull(),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),accessToken:text('access_token'),refreshToken:text('refresh_token'),idToken:text('id_token'),accessTokenExpiresAt:integer('access_token_expires_at',{mode:'timestamp_ms'}),refreshTokenExpiresAt:integer('refresh_token_expires_at',{mode:'timestamp_ms'}),scope:text('scope'),password:text('password'),createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),
},t=>[index('account_user_idx').on(t.userId)]);
export const verification=sqliteTable('verification',{
 id:text('id').primaryKey(),identifier:text('identifier').notNull(),value:text('value').notNull(),expiresAt:integer('expires_at',{mode:'timestamp_ms'}).notNull(),createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),
},t=>[index('verification_identifier_idx').on(t.identifier)]);
export const rateLimit=sqliteTable('rateLimit',{id:text('id').primaryKey(),key:text('key').notNull().unique(),count:integer('count').notNull(),lastRequest:integer('lastRequest').notNull()});
export const spaces=sqliteTable('planner_spaces',{id:text('id').primaryKey(),name:text('name').notNull(),ownerId:text('owner_id').notNull().references(()=>user.id),createdAt:text('created_at').notNull()});
export const members=sqliteTable('planner_members',{spaceId:text('space_id').notNull().references(()=>spaces.id,{onDelete:'cascade'}),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),role:text('role').notNull()},t=>[primaryKey({columns:[t.spaceId,t.userId]}),index('members_user_idx').on(t.userId)]);
export const invitations=sqliteTable('planner_invitations',{tokenHash:text('token_hash').primaryKey(),spaceId:text('space_id').notNull().references(()=>spaces.id,{onDelete:'cascade'}),expiresAt:text('expires_at').notNull(),createdBy:text('created_by').notNull(),usedBy:text('used_by'),revokedAt:text('revoked_at')});
