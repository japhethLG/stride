/**
 * Convenience aliases for generated schema component types. Entity folders import
 * the DTOs they need from here so call sites get the unwrapped (`data`) shapes —
 * the same shapes the api client middleware surfaces after stripping the
 * `{ success, data }` envelope.
 */
import type { components } from "@/lib/api/schema";

export type Schemas = components["schemas"];

// Activities
export type ActivityDto = Schemas["ActivityDto"];
export type ActivityResponseDto = Schemas["ActivityResponseDto"];
export type ActivityListResponseDto = Schemas["ActivityListResponseDto"];
export type CreateActivityRequestDto = Schemas["CreateActivityRequestDto"];
export type ActivityPointRequestDto = Schemas["ActivityPointRequestDto"];
export type BestEffortResponseDto = Schemas["BestEffortResponseDto"];
export type DeleteActivityResponseDto = Schemas["DeleteActivityResponseDto"];

// Auth / me
export type MeDto = Schemas["MeResponseDto"];
export type MeResponseDto = Schemas["MeResponseDto"];
export type UpdateMeRequestDto = Schemas["UpdateMeRequestDto"];

// Stats
export type StatsSummaryResponseDto = Schemas["StatsSummaryResponseDto"];

// Routes
export type RouteDto = Schemas["RouteDto"];
export type RouteResponseDto = Schemas["RouteResponseDto"];
export type RouteDetailResponseDto = Schemas["RouteDetailResponseDto"];
export type RouteListResponseDto = Schemas["RouteListResponseDto"];
export type CreateRouteRequestDto = Schemas["CreateRouteRequestDto"];
export type UpdateRouteRequestDto = Schemas["UpdateRouteRequestDto"];
export type RouteGeometryRequestDto = Schemas["RouteGeometryRequestDto"];
export type RouteElevationRequestDto = Schemas["RouteElevationRequestDto"];
export type GeoJsonLineStringDto = Schemas["GeoJsonLineStringDto"];
export type SegmentDto = Schemas["SegmentDto"];

// Memberships / invites
export type MembershipResponseDto = Schemas["MembershipResponseDto"];
export type MemberListResponseDto = Schemas["MemberListResponseDto"];
export type MembershipUserDto = Schemas["MembershipUserDto"];
export type RouteMembershipDto = Schemas["RouteMembershipDto"];
export type InviteListResponseDto = Schemas["InviteListResponseDto"];
export type InviteMemberRequestDto = Schemas["InviteMemberRequestDto"];

// Leaderboard / segments
export type LeaderboardResponseDto = Schemas["LeaderboardResponseDto"];
export type LeaderboardEntryResponseDto = Schemas["LeaderboardEntryResponseDto"];
export type MyLeaderboardEntryResponseDto = Schemas["MyLeaderboardEntryResponseDto"];

// Routing
export type SnapRouteRequestDto = Schemas["SnapRouteRequestDto"];
export type SnapPointRequestDto = Schemas["SnapPointRequestDto"];
export type SnapResponseDto = Schemas["SnapResponseDto"];

// Live
export type LiveSessionResponseDto = Schemas["LiveSessionResponseDto"];
export type LiveParticipantsResponseDto = Schemas["LiveParticipantsResponseDto"];
export type LiveParticipantResponseDto = Schemas["LiveParticipantResponseDto"];
