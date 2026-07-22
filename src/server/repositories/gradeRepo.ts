import type { SupabaseClient } from "@supabase/supabase-js";

export function gradeRepo(supabase: SupabaseClient) {
  // ── Categories ─────────────────────────────────────────────────────────────

  async function listCategories(classId: string) {
    const { data } = await supabase
      .from("grade_categories")
      .select("id, name, weight, order_index")
      .eq("class_id", classId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true });
    return data ?? [];
  }

  async function createCategory(classId: string, name: string, weight: number) {
    const { data: existing } = await supabase
      .from("grade_categories")
      .select("order_index")
      .eq("class_id", classId)
      .is("deleted_at", null)
      .order("order_index", { ascending: false })
      .limit(1);
    const nextOrder = ((existing ?? [])[0]?.order_index ?? -1) + 1;

    const { data, error } = await supabase
      .from("grade_categories")
      .insert({ class_id: classId, name, weight, order_index: nextOrder })
      .select()
      .single();
    return { data, error };
  }

  async function updateCategory(id: string, classId: string, name: string, weight: number) {
    const { error } = await supabase
      .from("grade_categories")
      .update({ name, weight })
      .eq("id", id)
      .eq("class_id", classId);
    return { error };
  }

  async function deleteCategory(id: string, classId: string) {
    const { error } = await supabase
      .from("grade_categories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("class_id", classId);
    return { error };
  }

  // ── Grade Items ─────────────────────────────────────────────────────────────

  async function listItems(classId: string) {
    const { data } = await supabase
      .from("grade_items")
      .select("id, category_id, quiz_id, title, max_score, due_at, missing_policy, created_at")
      .eq("class_id", classId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    return data ?? [];
  }

  async function findItemByQuiz(quizId: string, classId: string) {
    const { data } = await supabase
      .from("grade_items")
      .select("id, max_score")
      .eq("quiz_id", quizId)
      .eq("class_id", classId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    return data;
  }

  async function createItem(
    classId: string,
    categoryId: string,
    title: string,
    maxScore: number,
    quizId?: string | null,
    dueAt?: string | null,
    missingPolicy: string = "ignore_until_due"
  ) {
    const { data, error } = await supabase
      .from("grade_items")
      .insert({
        class_id: classId,
        category_id: categoryId,
        title,
        max_score: maxScore,
        quiz_id: quizId ?? null,
        due_at: dueAt ?? null,
        missing_policy: missingPolicy,
      })
      .select()
      .single();
    return { data, error };
  }

  async function updateItem(
    id: string,
    classId: string,
    fields: {
      title?: string;
      maxScore?: number;
      quizId?: string | null;
      dueAt?: string | null;
      missingPolicy?: string;
    }
  ) {
    const payload: Record<string, unknown> = {};
    if (fields.title !== undefined) payload.title = fields.title;
    if (fields.maxScore !== undefined) payload.max_score = fields.maxScore;
    if ("quizId" in fields) payload.quiz_id = fields.quizId ?? null;
    if ("dueAt" in fields) payload.due_at = fields.dueAt ?? null;
    if (fields.missingPolicy !== undefined) payload.missing_policy = fields.missingPolicy;
    const { error } = await supabase
      .from("grade_items")
      .update(payload)
      .eq("id", id)
      .eq("class_id", classId);
    return { error };
  }

  async function deleteItem(id: string, classId: string) {
    const { error } = await supabase
      .from("grade_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("class_id", classId);
    return { error };
  }

  /** True if the grade item exists in the given class (and is not deleted). */
  async function itemBelongsToClass(gradeItemId: string, classId: string): Promise<boolean> {
    const { data } = await supabase
      .from("grade_items")
      .select("id")
      .eq("id", gradeItemId)
      .eq("class_id", classId)
      .is("deleted_at", null)
      .maybeSingle();
    return !!data;
  }

  /**
   * True if the student is reachable from the class roster — either through an
   * explicit `class_students` row, or implicitly by having a quiz attempt on a
   * quiz that belongs to the class (the roster lists both kinds).
   */
  async function studentBelongsToClass(studentId: string, classId: string): Promise<boolean> {
    const { data: explicit } = await supabase
      .from("class_students")
      .select("id")
      .eq("class_id", classId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (explicit) return true;

    // Implicit: student has an attempt on a quiz in one of this class's modules.
    const { data: moduleRows } = await supabase
      .from("modules")
      .select("id")
      .eq("class_id", classId);
    const moduleIds = (moduleRows ?? []).map((m) => m.id);
    if (moduleIds.length === 0) return false;

    const { data: contentRows } = await supabase
      .from("contents")
      .select("id")
      .in("module_id", moduleIds)
      .eq("type", "quiz");
    const contentIds = (contentRows ?? []).map((c) => c.id);
    if (contentIds.length === 0) return false;

    const { data: quizRows } = await supabase
      .from("quizzes")
      .select("id")
      .in("content_id", contentIds);
    const quizIds = (quizRows ?? []).map((q) => q.id);
    if (quizIds.length === 0) return false;

    const { data: attempt } = await supabase
      .from("attempts")
      .select("id")
      .eq("student_id", studentId)
      .in("quiz_id", quizIds)
      .limit(1)
      .maybeSingle();
    return !!attempt;
  }

  // ── Grades ──────────────────────────────────────────────────────────────────

  async function listGradesByClass(classId: string) {
    const { data } = await supabase
      .from("grades")
      .select(`
        id,
        grade_item_id,
        student_id,
        score,
        notes,
        updated_at,
        grade_items!inner(class_id)
      `)
      .eq("grade_items.class_id", classId);
    return (data ?? []) as {
      id: string;
      grade_item_id: string;
      student_id: string;
      score: number | null;
      notes: string | null;
      updated_at: string;
    }[];
  }

  async function upsertGrade(gradeItemId: string, studentId: string, score: number) {
    const { error } = await supabase
      .from("grades")
      .upsert(
        { grade_item_id: gradeItemId, student_id: studentId, score },
        { onConflict: "grade_item_id,student_id" }
      );
    return { error };
  }

  async function updateGrade(gradeId: string, score: number | null, notes: string | null) {
    const { error } = await supabase
      .from("grades")
      .update({ score, notes })
      .eq("id", gradeId);
    return { error };
  }

  async function upsertGradeWithNotes(
    gradeItemId: string,
    studentId: string,
    score: number | null,
    notes: string | null
  ) {
    const { data, error } = await supabase
      .from("grades")
      .upsert(
        { grade_item_id: gradeItemId, student_id: studentId, score, notes },
        { onConflict: "grade_item_id,student_id" }
      )
      .select("id")
      .single();
    return { data, error };
  }

  // ── Attempt-based scores for quiz-linked grade items ────────────────────────

  async function listAttemptScoresByQuizIds(quizIds: string[]) {
    if (quizIds.length === 0) return [];
    const { data } = await supabase
      .from("attempts")
      .select("quiz_id, student_id, score, max_score")
      .in("quiz_id", quizIds)
      .in("status", ["submitted", "graded"]);
    return (data ?? []) as {
      quiz_id: string; student_id: string;
      score: number | null; max_score: number | null;
    }[];
  }

  // ── Roster ──────────────────────────────────────────────────────────────────

  type EnrolledRow = {
    id: string;
    status: string;
    created_at: string;
    students: {
      id: string; email: string;
      first_name: string | null; last_name: string | null;
      display_name: string | null;
    };
  };

  async function listEnrolled(classId: string): Promise<EnrolledRow[]> {
    // Source 1: students with an explicit class_students row
    const { data: csRows } = await supabase
      .from("class_students")
      .select("id, status, created_at, students(id, email, first_name, last_name, display_name)")
      .eq("class_id", classId)
      .order("created_at", { ascending: true });

    const enrolled = (csRows ?? []) as unknown as EnrolledRow[];
    const enrolledIds = new Set(enrolled.map((e) => e.students.id));

    // Source 2: students with quiz attempts in this class but no class_students row yet
    // contents don't have class_id — must go through modules
    const { data: moduleRows } = await supabase
      .from("modules")
      .select("id")
      .eq("class_id", classId);

    const moduleIds = (moduleRows ?? []).map((m) => m.id);

    const contentIds: string[] = [];
    if (moduleIds.length > 0) {
      const { data: contentRows } = await supabase
        .from("contents")
        .select("id")
        .in("module_id", moduleIds)
        .eq("type", "quiz");
      contentIds.push(...(contentRows ?? []).map((c) => c.id));
    }

    if (contentIds.length > 0) {
      const { data: quizRows } = await supabase
        .from("quizzes")
        .select("id")
        .in("content_id", contentIds);

      const quizIds = (quizRows ?? []).map((q) => q.id);

      if (quizIds.length > 0) {
        const { data: attemptRows } = await supabase
          .from("attempts")
          .select("student_id")
          .in("quiz_id", quizIds);

        const unseenIds = [
          ...new Set(
            (attemptRows ?? [])
              .map((a) => a.student_id as string)
              .filter((id) => !enrolledIds.has(id))
          ),
        ];

        if (unseenIds.length > 0) {
          const { data: studentRows } = await supabase
            .from("students")
            .select("id, email, first_name, last_name, display_name")
            .in("id", unseenIds);

          for (const s of studentRows ?? []) {
            enrolled.push({
              id: `implicit-${s.id}`,   // no real class_students row yet
              status: "active",
              created_at: new Date().toISOString(),
              students: s,
            });
          }
        }
      }
    }

    return enrolled;
  }

  async function enrollStudent(
    classId: string,
    email: string,
    firstName: string | null,
    lastName: string | null
  ) {
    // Upsert student by email
    const { data: student, error: sErr } = await supabase
      .from("students")
      .upsert({ email, first_name: firstName, last_name: lastName }, { onConflict: "email" })
      .select("id")
      .single();
    if (sErr || !student) return { error: sErr?.message ?? "student_upsert_failed" };

    // Enroll in class (ignore duplicate)
    const { error: cErr } = await supabase
      .from("class_students")
      .upsert(
        { class_id: classId, student_id: student.id, status: "active" },
        { onConflict: "class_id,student_id" }
      );
    if (cErr) return { error: cErr.message };
    return { studentId: student.id };
  }

  async function setEnrollmentStatus(
    enrollmentId: string,
    classId: string,
    status: "active" | "inactive"
  ) {
    const { error } = await supabase
      .from("class_students")
      .update({ status })
      .eq("id", enrollmentId)
      .eq("class_id", classId);
    return { error };
  }

  /** Update a student's name fields. */
  async function updateStudentProfile(
    studentId: string,
    firstName: string | null,
    lastName: string | null
  ) {
    const { error } = await supabase
      .from("students")
      .update({ first_name: firstName, last_name: lastName })
      .eq("id", studentId);
    return { error };
  }

  /** Hard-delete an explicit class_students row scoped to its class. */
  async function removeEnrollment(enrollmentId: string, classId: string) {
    const { error } = await supabase
      .from("class_students")
      .delete()
      .eq("id", enrollmentId)
      .eq("class_id", classId);
    return { error };
  }

  /**
   * Block an "implicit" student who has no class_students row yet.
   * Creates a row with status='inactive' so they stop appearing in the implicit list.
   */
  async function blockImplicitStudent(classId: string, studentId: string) {
    const { error } = await supabase
      .from("class_students")
      .upsert(
        { class_id: classId, student_id: studentId, status: "inactive" },
        { onConflict: "class_id,student_id" }
      );
    return { error };
  }

  return {
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    listItems,
    findItemByQuiz,
    itemBelongsToClass,
    studentBelongsToClass,
    createItem,
    updateItem,
    deleteItem,
    listGradesByClass,
    listAttemptScoresByQuizIds,
    upsertGrade,
    updateGrade,
    upsertGradeWithNotes,
    listEnrolled,
    enrollStudent,
    setEnrollmentStatus,
    updateStudentProfile,
    removeEnrollment,
    blockImplicitStudent,
  };
}
