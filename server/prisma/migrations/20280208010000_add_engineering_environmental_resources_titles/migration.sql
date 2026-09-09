-- AlterEnum
-- Three titles matching statutory appointments the MHSA already requires
-- (ENGINEER, ENVIRONMENTAL_CONTROL_OFFICER, SURVEYOR in StatutoryAppointmentType).
ALTER TYPE "ExecutiveTitle" ADD VALUE 'ENGINEERING_MANAGER';
ALTER TYPE "ExecutiveTitle" ADD VALUE 'ENVIRONMENTAL_MANAGER';
ALTER TYPE "ExecutiveTitle" ADD VALUE 'MINERAL_RESOURCES_MANAGER';
