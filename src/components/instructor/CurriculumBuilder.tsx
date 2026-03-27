import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, ChevronDown, GripVertical, Video, FileQuestion, ClipboardList, Pencil, Unlink, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import LessonModal from './LessonModal';
import QuizBuilderModal from './QuizBuilderModal';
import AssignmentModal from './AssignmentModal';
import ItemPickerModal from './ItemPickerModal';
import MaterialUploadModal from './MaterialUploadModal';

interface CurriculumBuilderProps {
  courseId: string;
}

const CurriculumBuilder = ({ courseId }: CurriculumBuilderProps) => {
  const [lessonModal, setLessonModal] = useState<{ open: boolean; sectionId: string; lesson?: any }>({ open: false, sectionId: '' });
  const [quizModal, setQuizModal] = useState<{ open: boolean; sectionId: string; quiz?: any; questions?: any[] }>({ open: false, sectionId: '' });
  const [assignmentModal, setAssignmentModal] = useState<{ open: boolean; sectionId: string; assignment?: any }>({ open: false, sectionId: '' });
  const [pickerModal, setPickerModal] = useState<{ open: boolean; type: 'lesson' | 'quiz' | 'assignment'; sectionId: string }>({ open: false, type: 'lesson', sectionId: '' });
  const [materialModal, setMaterialModal] = useState<{ open: boolean; sectionId: string }>({ open: false, sectionId: '' });
  const [editingTitle, setEditingTitle] = useState<string | null>(null);

  const { data: sections = [], refetch } = useQuery({
    queryKey: ['curriculum-sections', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_sections')
        .select('*')
        .eq('course_id', courseId)
        .order('sort_order');

      const sectionIds = (data ?? []).map((s: any) => s.id);

      let lessons: any[] = [];
      let quizzes: any[] = [];
      let assignments: any[] = [];
      if (sectionIds.length > 0) {
        const { data: l } = await supabase.from('lessons').select('*').in('section_id', sectionIds).order('sort_order');
        lessons = l ?? [];
        const { data: q } = await supabase.from('quizzes').select('*').in('section_id', sectionIds).order('sort_order');
        quizzes = q ?? [];
        const { data: a } = await supabase.from('assignments').select('*').in('section_id', sectionIds).order('sort_order');
        assignments = a ?? [];
      }

      return (data ?? []).map((s: any) => ({
        ...s,
        lessons: lessons.filter((l) => l.section_id === s.id),
        quizzes: quizzes.filter((q) => q.section_id === s.id),
        assignments: assignments.filter((a) => a.section_id === s.id),
        materials: Array.isArray(s.materials) ? s.materials : [],
      }));
    },
  });

  // --- Section CRUD ---
  const addSection = async () => {
    await supabase.from('course_sections').insert({
      course_id: courseId,
      title: `Topic ${sections.length + 1}`,
      sort_order: sections.length,
    });
    refetch();
  };

  const updateSectionTitle = async (id: string, title: string) => {
    await supabase.from('course_sections').update({ title }).eq('id', id);
  };

  const updateSectionDescription = async (id: string, description: string) => {
    await supabase.from('course_sections').update({ description }).eq('id', id);
  };

  const deleteSection = async (id: string) => {
    // Unlink all items first
    await supabase.from('lessons').update({ section_id: null }).eq('section_id', id);
    await supabase.from('quizzes').update({ section_id: null }).eq('section_id', id);
    await supabase.from('assignments').update({ section_id: null }).eq('section_id', id);
    await supabase.from('course_sections').delete().eq('id', id);
    refetch();
  };

  // --- Link items from picker ---
  const linkItem = async (type: 'lesson' | 'quiz' | 'assignment', itemId: string, sectionId: string) => {
    const table = type === 'lesson' ? 'lessons' : type === 'quiz' ? 'quizzes' : 'assignments';
    const updateData: any = { section_id: sectionId };
    if (type !== 'lesson') updateData.course_id = courseId;
    await supabase.from(table).update(updateData).eq('id', itemId);
    refetch();
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} linked`);
  };

  // --- Unlink (not delete) ---
  const unlinkItem = async (type: 'lesson' | 'quiz' | 'assignment', itemId: string) => {
    const table = type === 'lesson' ? 'lessons' : type === 'quiz' ? 'quizzes' : 'assignments';
    await supabase.from(table).update({ section_id: null }).eq('id', itemId);
    refetch();
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} unlinked`);
  };

  // --- Lesson save (for create new from within) ---
  const saveLesson = async (sectionId: string, data: any, existingId?: string) => {
    if (existingId) {
      await supabase.from('lessons').update(data).eq('id', existingId);
    } else {
      const section = sections.find((s: any) => s.id === sectionId);
      await supabase.from('lessons').insert({ ...data, section_id: sectionId, sort_order: section?.lessons?.length || 0 });
    }
    refetch();
    toast.success(existingId ? 'Lesson updated' : 'Lesson added');
  };

  // --- Quiz save ---
  const saveQuiz = async (sectionId: string, quizInfo: any, questions: any[], existingId?: string) => {
    let quizId = existingId;
    if (existingId) {
      await supabase.from('quizzes').update({ ...quizInfo, time_limit_minutes: quizInfo.time_limit_minutes ? Number(quizInfo.time_limit_minutes) : null }).eq('id', existingId);
    } else {
      const section = sections.find((s: any) => s.id === sectionId);
      const { data } = await supabase.from('quizzes').insert({
        ...quizInfo,
        time_limit_minutes: quizInfo.time_limit_minutes ? Number(quizInfo.time_limit_minutes) : null,
        course_id: courseId,
        section_id: sectionId,
        sort_order: section?.quizzes?.length || 0,
      }).select().single();
      quizId = data?.id;
    }
    if (quizId && questions.length > 0) {
      if (existingId) await supabase.from('quiz_questions').delete().eq('quiz_id', quizId);
      const qRows = questions.map((q, i) => ({
        quiz_id: quizId!,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation || null,
        points: q.points || 1,
        sort_order: i,
      }));
      await supabase.from('quiz_questions').insert(qRows);
    }
    refetch();
    toast.success(existingId ? 'Quiz updated' : 'Quiz added');
  };

  // --- Assignment save ---
  const saveAssignment = async (sectionId: string, data: any, existingId?: string) => {
    if (existingId) {
      await supabase.from('assignments').update(data).eq('id', existingId);
    } else {
      const section = sections.find((s: any) => s.id === sectionId);
      await supabase.from('assignments').insert({ ...data, course_id: courseId, section_id: sectionId, sort_order: section?.assignments?.length || 0 });
    }
    refetch();
    toast.success(existingId ? 'Assignment updated' : 'Assignment added');
  };

  // --- Materials ---
  const addMaterial = async (sectionId: string, material: { name: string; url: string; type: string }) => {
    const section = sections.find((s: any) => s.id === sectionId);
    const materials = [...(section?.materials || []), material];
    await supabase.from('course_sections').update({ materials }).eq('id', sectionId);
    refetch();
    toast.success('Material added');
  };

  const removeMaterial = async (sectionId: string, index: number) => {
    const section = sections.find((s: any) => s.id === sectionId);
    const materials = [...(section?.materials || [])];
    materials.splice(index, 1);
    await supabase.from('course_sections').update({ materials }).eq('id', sectionId);
    refetch();
  };

  // --- Edit quiz helper ---
  const openEditQuiz = async (quiz: any) => {
    const { data: questions } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quiz.id).order('sort_order');
    setQuizModal({ open: true, sectionId: quiz.section_id, quiz, questions: questions ?? [] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-lg">Course Curriculum</h3>
        <Button onClick={addSection} className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2">
          <Plus className="h-4 w-4" /> Add New Topic
        </Button>
      </div>

      {sections.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <p className="text-muted-foreground">No topics yet. Click "Add New Topic" to build your curriculum.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section: any) => (
            <Collapsible key={section.id} defaultOpen>
              <div className="border rounded-xl bg-card overflow-hidden">
                {/* Header — title + controls separated from collapsible trigger */}
                <div className="flex items-center gap-2 p-4 border-b bg-muted/20">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />

                  {editingTitle === section.id ? (
                    <Input
                      autoFocus
                      defaultValue={section.title}
                      onBlur={(e) => {
                        updateSectionTitle(section.id, e.target.value);
                        setEditingTitle(null);
                        refetch();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateSectionTitle(section.id, (e.target as HTMLInputElement).value);
                          setEditingTitle(null);
                          refetch();
                        }
                      }}
                      className="flex-1 h-8 text-sm font-semibold font-heading"
                    />
                  ) : (
                    <button
                      className="flex-1 text-left text-sm font-semibold font-heading hover:text-primary transition-colors truncate"
                      onClick={() => setEditingTitle(section.id)}
                      title="Click to rename"
                    >
                      {section.title}
                    </button>
                  )}

                  <span className="text-xs text-muted-foreground shrink-0">
                    {section.lessons.length}L · {section.quizzes.length}Q · {section.assignments.length}A
                  </span>

                  {editingTitle !== section.id && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingTitle(section.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => deleteSection(section.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>

                  <CollapsibleTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent>
                  <div className="px-4 pb-4 pt-3 space-y-3">
                    {/* Description */}
                    <Textarea
                      placeholder="Add a description for this topic..."
                      defaultValue={section.description || ''}
                      onBlur={(e) => updateSectionDescription(section.id, e.target.value)}
                      className="text-sm min-h-[60px] resize-none"
                      rows={2}
                    />

                    {/* Lessons */}
                    {section.lessons.map((lesson: any) => (
                      <div key={lesson.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border group">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <Video className="h-4 w-4 text-primary shrink-0" />
                        <span className="flex-1 text-sm font-medium truncate">{lesson.title}</span>
                        <span className="text-xs text-muted-foreground">{lesson.duration_minutes || 0} min</span>
                        {lesson.is_preview && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Preview</span>}
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setLessonModal({ open: true, sectionId: section.id, lesson })}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => unlinkItem('lesson', lesson.id)} title="Unlink from topic">
                          <Unlink className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}

                    {/* Quizzes */}
                    {section.quizzes.map((quiz: any) => (
                      <div key={quiz.id} className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border group">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <FileQuestion className="h-4 w-4 text-blue-600 shrink-0" />
                        <span className="flex-1 text-sm font-medium truncate">{quiz.title}</span>
                        <span className="text-xs text-muted-foreground">{quiz.pass_percentage}% pass</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => openEditQuiz(quiz)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => unlinkItem('quiz', quiz.id)} title="Unlink from topic">
                          <Unlink className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}

                    {/* Assignments */}
                    {section.assignments.map((assignment: any) => (
                      <div key={assignment.id} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border group">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <ClipboardList className="h-4 w-4 text-amber-600 shrink-0" />
                        <span className="flex-1 text-sm font-medium truncate">{assignment.title}</span>
                        <span className="text-xs text-muted-foreground">{assignment.max_score} marks</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setAssignmentModal({ open: true, sectionId: section.id, assignment })}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => unlinkItem('assignment', assignment.id)} title="Unlink from topic">
                          <Unlink className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}

                    {/* Materials */}
                    {section.materials.map((mat: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border group">
                        <FileText className="h-4 w-4 text-green-600 shrink-0" />
                        <span className="flex-1 text-sm font-medium truncate">{mat.name}</span>
                        <span className="text-xs text-muted-foreground uppercase">{mat.type}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => removeMaterial(section.id, idx)}>
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}

                    {/* Action buttons — open pickers */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-full" onClick={() => setPickerModal({ open: true, type: 'lesson', sectionId: section.id })}>
                        <Plus className="h-3 w-3" /> Lesson
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-full" onClick={() => setPickerModal({ open: true, type: 'quiz', sectionId: section.id })}>
                        <Plus className="h-3 w-3" /> Quiz
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-full" onClick={() => setPickerModal({ open: true, type: 'assignment', sectionId: section.id })}>
                        <Plus className="h-3 w-3" /> Assignment
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-full" onClick={() => setMaterialModal({ open: true, sectionId: section.id })}>
                        <Plus className="h-3 w-3" /> Material
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Item Picker Modal */}
      {pickerModal.open && (
        <ItemPickerModal
          open={pickerModal.open}
          onClose={() => setPickerModal({ open: false, type: 'lesson', sectionId: '' })}
          type={pickerModal.type}
          excludeIds={
            pickerModal.type === 'lesson'
              ? sections.find((s: any) => s.id === pickerModal.sectionId)?.lessons?.map((l: any) => l.id) || []
              : pickerModal.type === 'quiz'
              ? sections.find((s: any) => s.id === pickerModal.sectionId)?.quizzes?.map((q: any) => q.id) || []
              : sections.find((s: any) => s.id === pickerModal.sectionId)?.assignments?.map((a: any) => a.id) || []
          }
          onSelect={(id) => linkItem(pickerModal.type, id, pickerModal.sectionId)}
          onCreateNew={() => {
            if (pickerModal.type === 'lesson') setLessonModal({ open: true, sectionId: pickerModal.sectionId });
            else if (pickerModal.type === 'quiz') setQuizModal({ open: true, sectionId: pickerModal.sectionId });
            else setAssignmentModal({ open: true, sectionId: pickerModal.sectionId });
          }}
        />
      )}

      {/* Material Upload Modal */}
      {materialModal.open && (
        <MaterialUploadModal
          open={materialModal.open}
          onClose={() => setMaterialModal({ open: false, sectionId: '' })}
          onSave={(mat) => addMaterial(materialModal.sectionId, mat)}
        />
      )}

      {/* Modals */}
      {lessonModal.open && (
        <LessonModal
          open={lessonModal.open}
          onClose={() => setLessonModal({ open: false, sectionId: '' })}
          lesson={lessonModal.lesson}
          onSave={(data) => saveLesson(lessonModal.sectionId, data, lessonModal.lesson?.id)}
        />
      )}
      {quizModal.open && (
        <QuizBuilderModal
          open={quizModal.open}
          onClose={() => setQuizModal({ open: false, sectionId: '' })}
          quiz={quizModal.quiz}
          existingQuestions={quizModal.questions}
          onSave={(info, questions) => saveQuiz(quizModal.sectionId, info, questions, quizModal.quiz?.id)}
        />
      )}
      {assignmentModal.open && (
        <AssignmentModal
          open={assignmentModal.open}
          onClose={() => setAssignmentModal({ open: false, sectionId: '' })}
          assignment={assignmentModal.assignment}
          onSave={(data) => saveAssignment(assignmentModal.sectionId, data, assignmentModal.assignment?.id)}
        />
      )}
    </div>
  );
};

export default CurriculumBuilder;
