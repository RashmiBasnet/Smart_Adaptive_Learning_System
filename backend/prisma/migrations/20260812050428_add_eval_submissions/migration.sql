-- CreateEnum
CREATE TYPE "EvalPhase" AS ENUM ('PRE', 'POST');

-- CreateTable
CREATE TABLE "eval_submissions" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "concept_id" INTEGER NOT NULL,
    "phase" "EvalPhase" NOT NULL,
    "study_mode" TEXT,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eval_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_responses" (
    "id" SERIAL NOT NULL,
    "submission_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "selected_option_id" INTEGER,
    "is_correct" BOOLEAN NOT NULL,

    CONSTRAINT "eval_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eval_submissions_student_id_concept_id_phase_idx" ON "eval_submissions"("student_id", "concept_id", "phase");

-- AddForeignKey
ALTER TABLE "eval_submissions" ADD CONSTRAINT "eval_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_submissions" ADD CONSTRAINT "eval_submissions_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_responses" ADD CONSTRAINT "eval_responses_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "eval_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_responses" ADD CONSTRAINT "eval_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_responses" ADD CONSTRAINT "eval_responses_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "question_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
