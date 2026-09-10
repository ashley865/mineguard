-- AlterEnum
-- Ventilation and Rock Engineering match statutory appointments already named in
-- StatutoryAppointmentType (VENTILATION_OFFICER/OCCUPATIONAL_HYGIENIST, ROCK_ENGINEER).
-- Community Relations carries the Social and Labour Plan and Mining Charter obligations.
ALTER TYPE "ExecutiveTitle" ADD VALUE 'VENTILATION_MANAGER';
ALTER TYPE "ExecutiveTitle" ADD VALUE 'ROCK_ENGINEERING_MANAGER';
ALTER TYPE "ExecutiveTitle" ADD VALUE 'COMMUNITY_RELATIONS_MANAGER';
