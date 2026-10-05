"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Loader2,
  Mail,
  Plus,
  Save,
  Share2,
  Trash2,
  Upload,
  UserRound,
  Video,
  X,
} from "lucide-react";

import {
  useParams,
  useRouter,
} from "next/navigation";

type Performer = {
  id: string;
  displayName: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type PerformerResponse = {
  success: boolean;
  performer?: Performer;
  error?: string;
  message?: string;
};

type PerformerDocument = {
  id: string;
  documentType: string;
  title: string;
  status: string;
  contentType: string;
  fileSize: number;
  documentNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type PerformerDocumentsResponse = {
  success: boolean;
  documents?: PerformerDocument[];
  document?: PerformerDocument;
  error?: string;
  message?: string;
};

type Agreement = {
  id: string;
  templateKey: string;
  templateVersion: string;
  status: string;
  agreementType: string;
  contentDescription: string;
  agreementDate: string;
  governingLaw: string | null;
  jurisdiction: string | null;
  uploaderLegalName: string;
  uploaderEmail: string | null;
  coPerformerLegalName: string;
  coPerformerEmail: string | null;
  residentialAddress: string | null;
  createdAt: string;
  updatedAt: string;
};

type AgreementsResponse = {
  success: boolean;
  agreements?: Agreement[];
  agreement?: Agreement;
  error?: string;
  message?: string;
};

type AgreementForm = {
  agreementType:
    | "SINGLE_CONTENT"
    | "MULTIPLE_CONTENT";
  contentDescription: string;
  agreementDate: string;
  governingLaw: string;
  jurisdiction: string;
  uploaderLegalName: string;
  uploaderEmail: string;
  coPerformerLegalName: string;
  coPerformerEmail: string;
  residentialAddress: string;
};

const EMPTY_AGREEMENT_FORM: AgreementForm = {
  agreementType:
    "SINGLE_CONTENT",
  contentDescription: "",
  agreementDate:
    new Date()
      .toISOString()
      .slice(0, 10),
  governingLaw: "",
  jurisdiction: "",
  uploaderLegalName: "",
  uploaderEmail: "",
  coPerformerLegalName: "",
  coPerformerEmail: "",
  residentialAddress: "",
};

type DocumentForm = {
  documentType:
    | "PHOTO_ID"
    | "PROOF_OF_ADDRESS"
    | "RELEASE_FORM"
    | "TEST_RESULT"
    | "OTHER";
  title: string;
  documentNumber: string;
  issuedAt: string;
  expiresAt: string;
  notes: string;
};

const EMPTY_DOCUMENT_FORM: DocumentForm = {
  documentType:
    "PHOTO_ID",
  title: "",
  documentNumber: "",
  issuedAt: "",
  expiresAt: "",
  notes: "",
};

type ProfileForm = {
  displayName: string;
  legalName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  status: "ACTIVE" | "INACTIVE";
  notes: string;
};

type TabId =
  | "PROFILE"
  | "CONTRACTS"
  | "DOCUMENTS"
  | "EXAMS"
  | "MEDIA";

const EMPTY_FORM: ProfileForm = {
  displayName: "",
  legalName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  status: "ACTIVE",
  notes: "",
};

export default function PerformerDetailPage() {
  const router =
    useRouter();

  const params =
    useParams<{
      locale: string;
      id: string;
    }>();

  const locale =
    params.locale ||
    "en-US";

  const performerId =
    params.id;

  const [
    performer,
    setPerformer,
  ] = useState<Performer | null>(
    null,
  );

  const [
    form,
    setForm,
  ] = useState<ProfileForm>(
    EMPTY_FORM,
  );

  const [
    activeTab,
    setActiveTab,
  ] = useState<TabId>(
    "PROFILE",
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    pageSuccess,
    setPageSuccess,
  ] = useState("");

  const [
    documents,
    setDocuments,
  ] = useState<PerformerDocument[]>(
    [],
  );

  const [
    documentsLoaded,
    setDocumentsLoaded,
  ] = useState(false);

  const [
    isDocumentsLoading,
    setIsDocumentsLoading,
  ] = useState(false);

  const [
    isDocumentUploadOpen,
    setIsDocumentUploadOpen,
  ] = useState(false);

  const [
    isUploadingDocument,
    setIsUploadingDocument,
  ] = useState(false);

  const [
    documentFile,
    setDocumentFile,
  ] = useState<File | null>(
    null,
  );

  const [
    documentForm,
    setDocumentForm,
  ] = useState<DocumentForm>(
    EMPTY_DOCUMENT_FORM,
  );


  const [
    agreements,
    setAgreements,
  ] = useState<Agreement[]>(
    [],
  );

  const [
    agreementsLoaded,
    setAgreementsLoaded,
  ] = useState(false);

  const [
    isAgreementsLoading,
    setIsAgreementsLoading,
  ] = useState(false);

  const [
    isAgreementFormOpen,
    setIsAgreementFormOpen,
  ] = useState(false);

  const [
    isCreatingAgreement,
    setIsCreatingAgreement,
  ] = useState(false);

  const [
    agreementForm,
    setAgreementForm,
  ] = useState<AgreementForm>(
    EMPTY_AGREEMENT_FORM,
  );

  const loadPerformer =
    useCallback(async () => {
      try {
        setIsLoading(true);
        setPageError("");

        const response =
          await fetch(
            `/api/performers/${encodeURIComponent(
              performerId,
            )}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const data =
          (await response.json()) as PerformerResponse;

        if (
          !response.ok ||
          !data.success ||
          !data.performer
        ) {
          throw new Error(
            data.message ||
              data.error ||
              "Unable to load performer.",
          );
        }

        const current =
          data.performer;

        setPerformer(
          current,
        );

        setForm({
          displayName:
            current.displayName,
          legalName:
            current.legalName ||
            "",
          email:
            current.email ||
            "",
          phone:
            current.phone ||
            "",
          dateOfBirth:
            current.dateOfBirth ||
            "",
          status:
            current.status ===
            "INACTIVE"
              ? "INACTIVE"
              : "ACTIVE",
          notes:
            current.notes ||
            "",
        });
      } catch (error) {
        console.error(
          "PERFORMER_LOAD_ERROR",
          error,
        );

        setPageError(
          error instanceof Error
            ? error.message
            : "Unable to load performer.",
        );
      } finally {
        setIsLoading(false);
      }
    }, [
      performerId,
    ]);

  useEffect(() => {
    void loadPerformer();
  }, [
    loadPerformer,
  ]);



  const loadAgreements =
    useCallback(async () => {
      try {
        setIsAgreementsLoading(true);
        setPageError("");

        const response =
          await fetch(
            `/api/performers/${encodeURIComponent(
              performerId,
            )}/agreements`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const data =
          (await response.json()) as AgreementsResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              data.error ||
              "Unable to load contracts.",
          );
        }

        setAgreements(
          data.agreements ??
            [],
        );

        setAgreementsLoaded(
          true,
        );
      } catch (error) {
        console.error(
          "PERFORMER_AGREEMENTS_LOAD_ERROR",
          error,
        );

        setPageError(
          error instanceof Error
            ? error.message
            : "Unable to load contracts.",
        );
      } finally {
        setIsAgreementsLoading(false);
      }
    }, [
      performerId,
    ]);

  useEffect(() => {
    if (
      activeTab ===
        "CONTRACTS" &&
      !agreementsLoaded &&
      !isAgreementsLoading
    ) {
      void loadAgreements();
    }
  }, [
    activeTab,
    agreementsLoaded,
    isAgreementsLoading,
    loadAgreements,
  ]);

  useEffect(() => {
    if (
      performer &&
      !agreementForm.coPerformerLegalName
    ) {
      setAgreementForm(
        (current) => ({
          ...current,
          coPerformerLegalName:
            performer.legalName ||
            performer.displayName,
          coPerformerEmail:
            performer.email ||
            "",
        }),
      );
    }
  }, [
    performer,
    agreementForm.coPerformerLegalName,
  ]);

  function updateAgreementForm(
    field: keyof AgreementForm,
    value: string,
  ) {
    setAgreementForm(
      (current) => ({
        ...current,
        [field]:
          value,
      }),
    );
  }

  async function createAgreement(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !agreementForm.uploaderLegalName.trim()
    ) {
      setPageError(
        "Uploader legal name is required.",
      );
      return;
    }

    if (
      !agreementForm.coPerformerLegalName.trim()
    ) {
      setPageError(
        "Co-performer legal name is required.",
      );
      return;
    }

    if (
      !agreementForm.contentDescription.trim()
    ) {
      setPageError(
        "Content description is required.",
      );
      return;
    }

    try {
      setIsCreatingAgreement(true);
      setPageError("");
      setPageSuccess("");

      const response =
        await fetch(
          `/api/performers/${encodeURIComponent(
            performerId,
          )}/agreements`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                agreementType:
                  agreementForm.agreementType,
                contentDescription:
                  agreementForm.contentDescription.trim(),
                agreementDate:
                  agreementForm.agreementDate,
                governingLaw:
                  agreementForm.governingLaw.trim(),
                jurisdiction:
                  agreementForm.jurisdiction.trim(),
                uploaderLegalName:
                  agreementForm.uploaderLegalName.trim(),
                uploaderEmail:
                  agreementForm.uploaderEmail.trim(),
                coPerformerLegalName:
                  agreementForm.coPerformerLegalName.trim(),
                coPerformerEmail:
                  agreementForm.coPerformerEmail.trim(),
                residentialAddress:
                  agreementForm.residentialAddress.trim(),
              }),
          },
        );

      const data =
        (await response.json()) as AgreementsResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.agreement
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to create contract.",
        );
      }

      setIsAgreementFormOpen(
        false,
      );

      setAgreementForm({
        ...EMPTY_AGREEMENT_FORM,
        coPerformerLegalName:
          performer?.legalName ||
          performer?.displayName ||
          "",
        coPerformerEmail:
          performer?.email ||
          "",
      });

      setAgreementsLoaded(
        false,
      );

      setPageSuccess(
        "Contract draft created successfully.",
      );

      await loadAgreements();
    } catch (error) {
      console.error(
        "PERFORMER_AGREEMENT_CREATE_ERROR",
        error,
      );

      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to create contract.",
      );
    } finally {
      setIsCreatingAgreement(false);
    }
  }

  const loadDocuments =
    useCallback(async () => {
      try {
        setIsDocumentsLoading(true);
        setPageError("");

        const response =
          await fetch(
            `/api/performers/${encodeURIComponent(
              performerId,
            )}/documents`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const data =
          (await response.json()) as PerformerDocumentsResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              data.error ||
              "Unable to load documents.",
          );
        }

        setDocuments(
          data.documents ??
            [],
        );

        setDocumentsLoaded(
          true,
        );
      } catch (error) {
        console.error(
          "PERFORMER_DOCUMENTS_LOAD_ERROR",
          error,
        );

        setPageError(
          error instanceof Error
            ? error.message
            : "Unable to load documents.",
        );
      } finally {
        setIsDocumentsLoading(false);
      }
    }, [
      performerId,
    ]);

  useEffect(() => {
    if (
      (
        activeTab ===
          "DOCUMENTS" ||
        activeTab ===
          "EXAMS"
      ) &&
      !documentsLoaded &&
      !isDocumentsLoading
    ) {
      void loadDocuments();
    }
  }, [
    activeTab,
    documentsLoaded,
    isDocumentsLoading,
    loadDocuments,
  ]);

  function updateDocumentForm(
    field: keyof DocumentForm,
    value: string,
  ) {
    setDocumentForm(
      (current) => ({
        ...current,
        [field]:
          value,
      }),
    );
  }

  async function uploadDocument(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!documentFile) {
      setPageError(
        "Select a document file.",
      );
      return;
    }

    try {
      setIsUploadingDocument(true);
      setPageError("");
      setPageSuccess("");

      const body =
        new FormData();

      body.append(
        "file",
        documentFile,
      );

      body.append(
        "documentType",
        documentForm.documentType,
      );

      body.append(
        "title",
        documentForm.title.trim(),
      );

      body.append(
        "documentNumber",
        documentForm.documentNumber.trim(),
      );

      body.append(
        "issuedAt",
        documentForm.issuedAt,
      );

      body.append(
        "expiresAt",
        documentForm.expiresAt,
      );

      body.append(
        "notes",
        documentForm.notes.trim(),
      );

      const response =
        await fetch(
          `/api/performers/${encodeURIComponent(
            performerId,
          )}/documents`,
          {
            method: "POST",
            body,
          },
        );

      const data =
        (await response.json()) as PerformerDocumentsResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to upload document.",
        );
      }

      setDocumentFile(
        null,
      );

      setDocumentForm(
        EMPTY_DOCUMENT_FORM,
      );

      setIsDocumentUploadOpen(
        false,
      );

      setDocumentsLoaded(
        false,
      );

      setPageSuccess(
        "Document uploaded successfully.",
      );

      await loadDocuments();
    } catch (error) {
      console.error(
        "PERFORMER_DOCUMENT_UPLOAD_ERROR",
        error,
      );

      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to upload document.",
      );
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function openDocument(
    documentId: string,
  ) {
    try {
      setPageError("");

      const response =
        await fetch(
          `/api/performers/${encodeURIComponent(
            performerId,
          )}/documents/${encodeURIComponent(
            documentId,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

      const data =
        (await response.json()) as {
          success: boolean;
          url?: string;
          error?: string;
          message?: string;
        };

      if (
        !response.ok ||
        !data.success ||
        !data.url
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to open document.",
        );
      }

      window.open(
        data.url,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (error) {
      console.error(
        "PERFORMER_DOCUMENT_OPEN_ERROR",
        error,
      );

      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to open document.",
      );
    }
  }

  const initials =
    useMemo(() => {
      const value =
        performer?.displayName
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map(
            (part) =>
              part.charAt(0),
          )
          .join("")
          .toUpperCase();

      return value || "?";
    }, [
      performer,
    ]);

  function updateForm(
    field: keyof ProfileForm,
    value: string,
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]:
          value,
      }),
    );
  }

  async function saveProfile(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !form.displayName.trim()
    ) {
      setPageError(
        "Display name is required.",
      );
      return;
    }

    try {
      setIsSaving(true);
      setPageError("");
      setPageSuccess("");

      const response =
        await fetch(
          `/api/performers/${encodeURIComponent(
            performerId,
          )}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                displayName:
                  form.displayName.trim(),
                legalName:
                  form.legalName.trim(),
                email:
                  form.email.trim(),
                phone:
                  form.phone.trim(),
                dateOfBirth:
                  form.dateOfBirth,
                status:
                  form.status,
                notes:
                  form.notes.trim(),
              }),
          },
        );

      const data =
        (await response.json()) as PerformerResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.performer
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to save profile.",
        );
      }

      setPerformer(
        data.performer,
      );

      setForm({
        displayName:
          data.performer
            .displayName,
        legalName:
          data.performer
            .legalName ||
          "",
        email:
          data.performer
            .email ||
          "",
        phone:
          data.performer
            .phone ||
          "",
        dateOfBirth:
          data.performer
            .dateOfBirth ||
          "",
        status:
          data.performer
            .status ===
          "INACTIVE"
            ? "INACTIVE"
            : "ACTIVE",
        notes:
          data.performer
            .notes ||
          "",
      });

      setPageSuccess(
        "Profile saved successfully.",
      );
    } catch (error) {
      console.error(
        "PERFORMER_SAVE_ERROR",
        error,
      );

      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to save profile.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePerformer() {
    if (
      !performer ||
      isDeleting
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${performer.displayName}"?\n\nThis permanently removes this performer profile and its related database records, including performer documents, agreements, media links and library folders. Stored media files are preserved. This action cannot be undone.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(
        true,
      );
      setPageError("");
      setPageSuccess("");

      const response =
        await fetch(
          `/api/performers/${encodeURIComponent(
            performerId,
          )}`,
          {
            method:
              "DELETE",
          },
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          error?: string;
          message?: string;
          relatedData?: {
            documents?: number;
            agreements?: number;
            mediaAssignments?: number;
            mediaInFolders?: number;
          };
        };

      if (
        !response.ok ||
        !data.success
      ) {
        if (
          data.error ===
          "PERFORMER_HAS_RELATED_DATA"
        ) {
          throw new Error(
            data.message ||
              "This performer has related data and cannot be deleted yet.",
          );
        }

        throw new Error(
          data.message ||
            data.error ||
            "Unable to delete performer.",
        );
      }

      router.push(
        `/app/performers`,
      );
      router.refresh();
    } catch (error) {
      console.error(
        "PERFORMER_DELETE_ERROR",
        error,
      );

      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to delete performer.",
      );
    } finally {
      setIsDeleting(
        false,
      );
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#080b12] text-white">
        <div className="flex min-h-[520px] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-400" />

            <div className="mt-3 text-xs text-white/30">
              Loading performer...
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (
    !performer
  ) {
    return (
      <main className="min-h-screen bg-[#080b12] text-white">
        <div className="mx-auto w-full max-w-[1540px] px-5 py-6 sm:px-7 lg:px-8">
          <Link
            href={`/app/performers`}
            className="inline-flex items-center gap-2 text-xs text-white/40 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Performers
          </Link>

          <div className="mt-6 rounded-[18px] border border-red-500/20 bg-red-500/[0.05] p-5 text-sm text-red-300">
            {pageError ||
              "Performer not found."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <div className="mx-auto w-full max-w-[1540px] px-5 py-6 sm:px-7 lg:px-8">
        <Link
          href={`/app/performers`}
          className="mb-5 inline-flex items-center gap-2 text-[11px] text-white/35 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Performers
        </Link>

        <div className="mb-5 rounded-[20px] border border-white/[0.08] bg-white/[0.018] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-500/15 bg-blue-500/[0.07] text-base font-semibold text-blue-200">
                {initials}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-[25px] font-semibold tracking-[-0.04em] text-white/95">
                    {
                      performer.displayName
                    }
                  </h1>

                  <StatusBadge
                    status={
                      performer.status
                    }
                  />
                </div>

                <div className="mt-1 text-[11px] text-white/30">
                  {performer.legalName ||
                    "Legal name not added"}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-white/25">
                  <span>
                    Added{" "}
                    {
                      formatDate(
                        performer.createdAt,
                      )
                    }
                  </span>

                  {performer.email && (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      {
                        performer.email
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-white/[0.06] bg-black/[0.08] px-3 py-2 text-[10px] text-white/25">
                Performer ID{" "}
                <span className="font-mono text-white/45">
                  {
                    performer.id
                      .slice(
                        0,
                        8,
                      )
                  }
                </span>
              </div>

              <button
                type="button"
                disabled={
                  isDeleting
                }
                onClick={() =>
                  void deletePerformer()
                }
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[10px] font-medium text-red-300 transition hover:bg-red-500/[0.12] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}

                {isDeleting
                  ? "Deleting..."
                  : "Delete performer"}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-5 overflow-x-auto">
          <div className="flex min-w-max gap-2">
            <TabButton
              active={
                activeTab ===
                "PROFILE"
              }
              icon={
                <UserRound className="h-3.5 w-3.5" />
              }
              label="Profile"
              onClick={() =>
                setActiveTab(
                  "PROFILE",
                )
              }
            />

            <TabButton
              active={
                activeTab ===
                "CONTRACTS"
              }
              icon={
                <FileText className="h-3.5 w-3.5" />
              }
              label="Contracts"
              onClick={() =>
                setActiveTab(
                  "CONTRACTS",
                )
              }
            />

            <TabButton
              active={
                activeTab ===
                "DOCUMENTS"
              }
              icon={
                <FolderOpen className="h-3.5 w-3.5" />
              }
              label="Documents"
              onClick={() => {
                setDocumentFile(
                  null,
                );
                setDocumentForm(
                  EMPTY_DOCUMENT_FORM,
                );
                setIsDocumentUploadOpen(
                  false,
                );
                setActiveTab(
                  "DOCUMENTS",
                );
              }}
            />

            <TabButton
              active={
                activeTab ===
                "EXAMS"
              }
              icon={
                <FileText className="h-3.5 w-3.5" />
              }
              label="Exams"
              onClick={() => {
                setDocumentFile(
                  null,
                );
                setDocumentForm({
                  ...EMPTY_DOCUMENT_FORM,
                  documentType:
                    "TEST_RESULT",
                });
                setIsDocumentUploadOpen(
                  false,
                );
                setActiveTab(
                  "EXAMS",
                );
              }}
            />

            <TabButton
              active={
                activeTab ===
                "MEDIA"
              }
              icon={
                <Video className="h-3.5 w-3.5" />
              }
              label="Media"
              onClick={() =>
                setActiveTab(
                  "MEDIA",
                )
              }
            />
          </div>
        </div>

        {pageSuccess && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-xs text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {
              pageSuccess
            }
          </div>
        )}

        {pageError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs text-red-300">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {
              pageError
            }
          </div>
        )}

        {activeTab ===
          "PROFILE" && (
          <ProfilePanel
            form={
              form
            }
            isSaving={
              isSaving
            }
            onChange={
              updateForm
            }
            onSubmit={
              saveProfile
            }
          />
        )}

        {activeTab ===
          "CONTRACTS" && (
          <ContractsPanel
            agreements={
              agreements
            }
            isLoading={
              isAgreementsLoading
            }
            isFormOpen={
              isAgreementFormOpen
            }
            isCreating={
              isCreatingAgreement
            }
            form={
              agreementForm
            }
            onOpenForm={() =>
              setIsAgreementFormOpen(
                true,
              )
            }
            onCloseForm={() => {
              if (
                isCreatingAgreement
              ) {
                return;
              }

              setIsAgreementFormOpen(
                false,
              );
            }}
            onFormChange={
              updateAgreementForm
            }
            onSubmit={
              createAgreement
            }
            onRefresh={
              loadAgreements
            }
          />
        )}

        {activeTab ===
          "DOCUMENTS" && (
          <DocumentsPanel
            title="Documents"
            description="Photo ID, proof of address, release forms and other compliance files."
            documents={
              documents.filter(
                (document) =>
                  document.documentType !==
                  "TEST_RESULT",
              )
            }
            isLoading={
              isDocumentsLoading
            }
            isUploadOpen={
              isDocumentUploadOpen
            }
            isUploading={
              isUploadingDocument
            }
            form={
              documentForm
            }
            file={
              documentFile
            }
            onOpenUpload={() => {
              setDocumentForm(
                EMPTY_DOCUMENT_FORM,
              );
              setDocumentFile(
                null,
              );
              setIsDocumentUploadOpen(
                true,
              );
            }}
            onCloseUpload={() => {
              if (
                isUploadingDocument
              ) {
                return;
              }

              setIsDocumentUploadOpen(
                false,
              );
              setDocumentFile(
                null,
              );
              setDocumentForm(
                EMPTY_DOCUMENT_FORM,
              );
            }}
            onFormChange={
              updateDocumentForm
            }
            onFileChange={
              setDocumentFile
            }
            onSubmit={
              uploadDocument
            }
            onOpenDocument={
              openDocument
            }
            onRefresh={
              loadDocuments
            }
          />
        )}

        {activeTab ===
          "EXAMS" && (
          <DocumentsPanel
            title="Exams"
            description="Health screening, laboratory results, STI/STD tests and other performer test records."
            emptyTitle="No exams yet"
            emptyDescription="Add the performer's first test result."
            uploadButtonLabel="Add exam"
            submitButtonLabel="Upload exam"
            forcedDocumentType="TEST_RESULT"
            documents={
              documents.filter(
                (document) =>
                  document.documentType ===
                  "TEST_RESULT",
              )
            }
            isLoading={
              isDocumentsLoading
            }
            isUploadOpen={
              isDocumentUploadOpen
            }
            isUploading={
              isUploadingDocument
            }
            form={
              documentForm
            }
            file={
              documentFile
            }
            onOpenUpload={() => {
              setDocumentForm({
                ...EMPTY_DOCUMENT_FORM,
                documentType:
                  "TEST_RESULT",
              });
              setDocumentFile(
                null,
              );
              setIsDocumentUploadOpen(
                true,
              );
            }}
            onCloseUpload={() => {
              if (
                isUploadingDocument
              ) {
                return;
              }

              setIsDocumentUploadOpen(
                false,
              );
              setDocumentFile(
                null,
              );
              setDocumentForm({
                ...EMPTY_DOCUMENT_FORM,
                documentType:
                  "TEST_RESULT",
              });
            }}
            onFormChange={
              updateDocumentForm
            }
            onFileChange={
              setDocumentFile
            }
            onSubmit={
              uploadDocument
            }
            onOpenDocument={
              openDocument
            }
            onRefresh={
              loadDocuments
            }
          />
        )}

        {activeTab ===
          "MEDIA" && (
          <ComingSoonPanel
            icon={
              <Video className="h-7 w-7" />
            }
            title="Media"
            description="Link this performer to videos and other media in your Media Library."
          />
        )}
      </div>
    </main>
  );
}

function ProfilePanel({
  form,
  isSaving,
  onChange,
  onSubmit,
}: {
  form: ProfileForm;
  isSaving: boolean;
  onChange: (
    field: keyof ProfileForm,
    value: string,
  ) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
}) {
  return (
    <form
      onSubmit={
        onSubmit
      }
      className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.018]"
    >
      <div className="border-b border-white/[0.06] px-5 py-4">
        <div className="text-sm font-semibold text-white/90">
          Profile information
        </div>

        <div className="mt-1 text-[10px] text-white/30">
          Basic identity and contact information used across contracts, documents and media relationships.
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Display name"
            required
          >
            <input
              value={
                form.displayName
              }
              onChange={(
                event,
              ) =>
                onChange(
                  "displayName",
                  event.target
                    .value,
                )
              }
              maxLength={
                120
              }
              className="input-field"
            />
          </Field>

          <Field label="Legal name">
            <input
              value={
                form.legalName
              }
              onChange={(
                event,
              ) =>
                onChange(
                  "legalName",
                  event.target
                    .value,
                )
              }
              maxLength={
                160
              }
              className="input-field"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={
                form.email
              }
              onChange={(
                event,
              ) =>
                onChange(
                  "email",
                  event.target
                    .value,
                )
              }
              maxLength={
                254
              }
              className="input-field"
            />
          </Field>

          <Field label="Phone">
            <input
              value={
                form.phone
              }
              onChange={(
                event,
              ) =>
                onChange(
                  "phone",
                  event.target
                    .value,
                )
              }
              maxLength={
                40
              }
              className="input-field"
            />
          </Field>

          <Field label="Date of birth">
            <input
              type="date"
              value={
                form.dateOfBirth
              }
              onChange={(
                event,
              ) =>
                onChange(
                  "dateOfBirth",
                  event.target
                    .value,
                )
              }
              className="input-field"
            />
          </Field>

          <Field label="Status">
            <select
              value={
                form.status
              }
              onChange={(
                event,
              ) =>
                onChange(
                  "status",
                  event.target
                    .value,
                )
              }
              className="input-field"
            >
              <option value="ACTIVE">
                Active
              </option>

              <option value="INACTIVE">
                Inactive
              </option>
            </select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Notes">
            <textarea
              value={
                form.notes
              }
              onChange={(
                event,
              ) =>
                onChange(
                  "notes",
                  event.target
                    .value,
                )
              }
              maxLength={
                4000
              }
              rows={
                5
              }
              className="input-field resize-none"
              placeholder="Internal notes..."
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end border-t border-white/[0.06] bg-black/[0.08] px-5 py-4">
        <button
          type="submit"
          disabled={
            isSaving ||
            !form.displayName.trim()
          }
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2.5 text-[11px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}

          {isSaving
            ? "Saving..."
            : "Save profile"}
        </button>
      </div>

      <style jsx>{`
        .input-field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: #0c1119;
          padding: 0.7rem 0.75rem;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.85);
          outline: none;
        }

        .input-field::placeholder {
          color: rgba(255, 255, 255, 0.18);
        }

        .input-field:focus {
          border-color: rgba(59, 130, 246, 0.35);
        }
      `}</style>
    </form>
  );
}



function ContractsPanel({
  agreements,
  isLoading,
  isFormOpen,
  isCreating,
  form,
  onOpenForm,
  onCloseForm,
  onFormChange,
  onSubmit,
  onRefresh,
}: {
  agreements: Agreement[];
  isLoading: boolean;
  isFormOpen: boolean;
  isCreating: boolean;
  form: AgreementForm;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onFormChange: (
    field: keyof AgreementForm,
    value: string,
  ) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [
    selectedAgreement,
    setSelectedAgreement,
  ] = useState<Agreement | null>(
    null,
  );

  const [
    sharedAgreementId,
    setSharedAgreementId,
  ] = useState<string | null>(
    null,
  );

  async function shareAgreement(
    agreement: Agreement,
  ) {
    const title =
      "Co-Performer Release Agreement";

    const text =
      `${title} — ${agreement.coPerformerLegalName} — ${agreement.contentDescription}`;

    const url =
      window.location.href;

    try {
      if (
        typeof navigator.share ===
        "function"
      ) {
        await navigator.share({
          title,
          text,
          url,
        });

        setSharedAgreementId(
          agreement.id,
        );

        window.setTimeout(
          () =>
            setSharedAgreementId(
              null,
            ),
          2200,
        );

        return;
      }

      await navigator.clipboard.writeText(
        url,
      );

      setSharedAgreementId(
        agreement.id,
      );

      window.setTimeout(
        () =>
          setSharedAgreementId(
            null,
          ),
        2200,
      );
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name ===
          "AbortError"
      ) {
        return;
      }

      console.error(
        "AGREEMENT_SHARE_ERROR",
        error,
      );
    }
  }

  return (
    <section className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.018]">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-white/90">
            Contracts
          </div>

          <div className="mt-1 text-[10px] text-white/30">
            Co-Performer Release Agreement · ManyVids template v12.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void onRefresh()
            }
            disabled={
              isLoading
            }
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[10px] font-medium text-white/45 transition hover:bg-white/[0.05] hover:text-white/80 disabled:opacity-40"
          >
            <Loader2
              className={`h-3.5 w-3.5 ${
                isLoading
                  ? "animate-spin"
                  : ""
              }`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={
              onOpenForm
            }
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-3.5 py-2 text-[10px] font-semibold text-white transition hover:brightness-110"
          >
            <Plus className="h-3.5 w-3.5" />
            New contract
          </button>
        </div>
      </div>

      {isFormOpen && (
        <form
          onSubmit={
            onSubmit
          }
          className="border-b border-white/[0.06] bg-black/[0.08] px-5 py-5"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Field
              label="Agreement type"
              required
            >
              <select
                value={
                  form.agreementType
                }
                onChange={(
                  event,
                ) =>
                  onFormChange(
                    "agreementType",
                    event.target.value,
                  )
                }
                className="contract-input"
              >
                <option value="SINGLE_CONTENT">
                  Single video / content
                </option>
                <option value="MULTIPLE_CONTENT">
                  Multiple videos / content
                </option>
              </select>
            </Field>

            <Field
              label="Agreement date"
              required
            >
              <input
                type="date"
                value={
                  form.agreementDate
                }
                onChange={(
                  event,
                ) =>
                  onFormChange(
                    "agreementDate",
                    event.target.value,
                  )
                }
                className="contract-input"
              />
            </Field>

            <div className="lg:col-span-2">
              <Field
                label="Content description / title"
                required
              >
                <textarea
                  value={
                    form.contentDescription
                  }
                  onChange={(
                    event,
                  ) =>
                    onFormChange(
                      "contentDescription",
                      event.target.value,
                    )
                  }
                  rows={
                    3
                  }
                  maxLength={
                    1000
                  }
                  placeholder="Describe the video/content covered by this agreement."
                  className="contract-input resize-none"
                />
              </Field>
            </div>

            <Field
              label="Uploader legal name"
              required
            >
              <input
                value={
                  form.uploaderLegalName
                }
                onChange={(
                  event,
                ) =>
                  onFormChange(
                    "uploaderLegalName",
                    event.target.value,
                  )
                }
                maxLength={
                  160
                }
                className="contract-input"
              />
            </Field>

            <Field label="Uploader email">
              <input
                type="email"
                value={
                  form.uploaderEmail
                }
                onChange={(
                  event,
                ) =>
                  onFormChange(
                    "uploaderEmail",
                    event.target.value,
                  )
                }
                maxLength={
                  254
                }
                className="contract-input"
              />
            </Field>

            <Field
              label="Co-performer legal name"
              required
            >
              <input
                value={
                  form.coPerformerLegalName
                }
                onChange={(
                  event,
                ) =>
                  onFormChange(
                    "coPerformerLegalName",
                    event.target.value,
                  )
                }
                maxLength={
                  160
                }
                className="contract-input"
              />
            </Field>

            <Field label="Co-performer email">
              <input
                type="email"
                value={
                  form.coPerformerEmail
                }
                onChange={(
                  event,
                ) =>
                  onFormChange(
                    "coPerformerEmail",
                    event.target.value,
                  )
                }
                maxLength={
                  254
                }
                className="contract-input"
              />
            </Field>

            <div className="lg:col-span-2">
              <Field label="Co-performer residential address">
                <input
                  value={
                    form.residentialAddress
                  }
                  onChange={(
                    event,
                  ) =>
                    onFormChange(
                      "residentialAddress",
                      event.target.value,
                    )
                  }
                  maxLength={
                    300
                  }
                  className="contract-input"
                />
              </Field>
            </div>

            <Field label="Governing law">
              <input
                value={
                  form.governingLaw
                }
                onChange={(
                  event,
                ) =>
                  onFormChange(
                    "governingLaw",
                    event.target.value,
                  )
                }
                placeholder="e.g. California"
                maxLength={
                  160
                }
                className="contract-input"
              />
            </Field>

            <Field label="Jurisdiction / courts">
              <input
                value={
                  form.jurisdiction
                }
                onChange={(
                  event,
                ) =>
                  onFormChange(
                    "jurisdiction",
                    event.target.value,
                  )
                }
                placeholder="e.g. Orange County, California"
                maxLength={
                  200
                }
                className="contract-input"
              />
            </Field>
          </div>

          <div className="mt-4 rounded-xl border border-blue-500/10 bg-blue-500/[0.035] px-4 py-3 text-[9px] leading-4 text-blue-100/45">
            This draft stores the fields required by the Co-Performer Release Agreement template. PDF generation and electronic signatures are the next step.
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={
                isCreating
              }
              onClick={
                onCloseForm
              }
              className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-[10px] font-medium text-white/45 transition hover:bg-white/[0.04] hover:text-white/70 disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                isCreating
              }
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2.5 text-[10px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isCreating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              {isCreating
                ? "Creating..."
                : "Create draft"}
            </button>
          </div>
        </form>
      )}

      <div className="p-5">
        {isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-400" />
              <div className="mt-2 text-[10px] text-white/30">
                Loading contracts...
              </div>
            </div>
          </div>
        ) : agreements.length ===
          0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-black/[0.06] px-6 text-center">
            <FileText className="h-7 w-7 text-white/18" />
            <div className="mt-3 text-xs font-semibold text-white/55">
              No contracts yet
            </div>
            <div className="mt-1 max-w-lg text-[10px] text-white/25">
              Create a Co-Performer Release Agreement draft for this performer.
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {agreements.map(
              (agreement) => (
                <div
                  key={
                    agreement.id
                  }
                  className="rounded-2xl border border-white/[0.07] bg-black/[0.07] p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xs font-semibold text-white/80">
                          Co-Performer Release Agreement
                        </div>

                        <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2 py-1 text-[8px] font-semibold text-white/40">
                          {
                            agreement.templateVersion
                          }
                        </span>

                        <span className="rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1 text-[8px] font-semibold text-amber-300">
                          {
                            agreement.status
                          }
                        </span>
                      </div>

                      <div className="mt-2 text-[10px] font-medium text-white/45">
                        {
                          agreement.contentDescription
                        }
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-white/27">
                        <span>
                          {
                            agreement.agreementType ===
                            "MULTIPLE_CONTENT"
                              ? "Multiple content"
                              : "Single content"
                          }
                        </span>

                        <span>
                          Agreement date{" "}
                          {
                            formatDate(
                              agreement.agreementDate,
                            )
                          }
                        </span>

                        <span>
                          Co-performer:{" "}
                          {
                            agreement.coPerformerLegalName
                          }
                        </span>

                        <span>
                          Created{" "}
                          {
                            formatDate(
                              agreement.createdAt,
                            )
                          }
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedAgreement(
                            agreement,
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-[10px] font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View contract
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void shareAgreement(
                            agreement,
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-[10px] font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        {sharedAgreementId ===
                        agreement.id
                          ? "Shared / copied"
                          : "Share"}
                      </button>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {selectedAgreement && (
        <ContractPreviewModal
          agreement={
            selectedAgreement
          }
          onClose={() =>
            setSelectedAgreement(
              null,
            )
          }
        />
      )}

      <style jsx>{`
        .contract-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: #0c1119;
          padding: 0.7rem 0.75rem;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.85);
          outline: none;
        }

        .contract-input::placeholder {
          color: rgba(255, 255, 255, 0.18);
        }

        .contract-input:focus {
          border-color: rgba(59, 130, 246, 0.35);
        }
      `}</style>
    </section>
  );
}


function ContractPreviewModal({
  agreement,
  onClose,
}: {
  agreement: Agreement;
  onClose: () => void;
}) {
  const isMultiple =
    agreement.agreementType ===
    "MULTIPLE_CONTENT";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-[980px] flex-col overflow-hidden rounded-[22px] border border-white/[0.12] bg-[#0d1119] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-white/90">
              Contract preview
            </div>
            <div className="mt-1 text-[10px] text-white/30">
              Co-Performer Release Agreement · {
                agreement.templateVersion
              }
            </div>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/45 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Close contract preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto bg-[#e9e9e9] p-3 sm:p-6">
          <article className="mx-auto min-h-[1000px] max-w-[820px] bg-white px-7 py-9 text-[12px] leading-[1.62] text-black shadow-xl sm:px-12 sm:py-12">
            <h2 className="text-center text-[18px] font-bold">
              Co-Performer Release Agreement
            </h2>

            <div className="mt-1 text-center text-[11px]">
              (the "Agreement")
            </div>

            <p className="mt-7">
              In favor of{" "}
              <strong>
                {
                  agreement.uploaderLegalName
                }
              </strong>{" "}
              (hereinafter referred to as the "UPLOADER"). For good and valuable consideration, the receipt and sufficiency of which is hereby acknowledged, I,{" "}
              <strong>
                {
                  agreement.coPerformerLegalName
                }
              </strong>
              , with residential address at{" "}
              <strong>
                {
                  agreement.residentialAddress ||
                  "____________________________"
                }
              </strong>
              , hereby agree as follows:
            </p>

            <ContractClause number="1">
              I hereby represent that I am of sound mind and body, acting of my own free will and fully understand the terms of this Agreement, and I am legally able to execute this Agreement.
            </ContractClause>

            <ContractClause number="2">
              I hereby agree that I shall select one paragraph set forth in this Section 2, one of either paragraph A. or B., and my selection of that respective paragraph is my acknowledgement and understanding of the terms therein which shall apply to this Agreement.
            </ContractClause>

            <div className="ml-5 mt-3 space-y-3">
              <div
                className={`rounded border p-3 ${
                  !isMultiple
                    ? "border-black bg-neutral-100"
                    : "border-neutral-300"
                }`}
              >
                <div className="font-bold">
                  {isMultiple
                    ? "☐"
                    : "☑"}{" "}
                  A. Single Video/Content with UPLOADER
                </div>
                <p className="mt-1">
                  I hereby agree to be photographed, recorded and/or videotaped by or on behalf of UPLOADER in connection with my participation in{" "}
                  <strong>
                    {
                      agreement.contentDescription
                    }
                  </strong>{" "}
                  (hereinafter referred to as the "Content") on{" "}
                  <strong>
                    {
                      formatContractDate(
                        agreement.agreementDate,
                      )
                    }
                  </strong>
                  , and the reason to do so is voluntary and not under force, duress or any other reason.
                </p>
              </div>

              <div
                className={`rounded border p-3 ${
                  isMultiple
                    ? "border-black bg-neutral-100"
                    : "border-neutral-300"
                }`}
              >
                <div className="font-bold">
                  {isMultiple
                    ? "☑"
                    : "☐"}{" "}
                  B. Multiple Videos/Content with UPLOADER
                </div>
                <p className="mt-1">
                  I hereby agree to be photographed, recorded and/or videotaped by or on behalf of UPLOADER in connection with my participation in{" "}
                  <strong>
                    {
                      agreement.contentDescription
                    }
                  </strong>{" "}
                  and at my option may participate in other reasonably similar content with UPLOADER from time to time and at any time (hereinafter referred to as the "Content") from the date of this Agreement, and the reason to do so is voluntary and not under force, duress or any other reason.
                </p>
              </div>
            </div>

            <ContractClause number="3">
              I hereby agree and represent that I am AT LEAST 18 YEARS OLD (OR OVER THE AGE OF 21 YEARS IN PLACES WHERE THE AGE OF MAJORITY IS NOT 18 YEARS), AND THE AGE OF MAJORITY AND LEGAL CONSENT IN THE JURISDICTION IN WHICH I LIVE OR RESIDE at the time that the Content is created and I am in full legal capacity. Further, I fully understand and acknowledge the adult nature of the Content and hereby consent to appear fully and/or partially nude in such Content.
            </ContractClause>

            <ContractClause number="3.1">
              I hereby agree to provide the UPLOADER the following documentation:
            </ContractClause>

            <div className="ml-8 mt-2 space-y-2">
              <p>
                <strong>3.1.1.</strong> A copy of a valid government issued photo identifying document ("ID") that evidences my date of birth, ID expiration date, my photo and my full legal name, with such ID not expiring within six (6) months from the date of execution of this Agreement. Such ID can be a government issued driver's license, passport, citizenship card, state or provincial ID, national passport or national ID card.
              </p>
              <p>
                <strong>3.1.2.</strong> A copy of a valid government issued official document mentioning my legal name and address.
              </p>
            </div>

            <ContractClause number="3.2">
              ID Documents shall be attached to this Agreement.
            </ContractClause>

            <ContractClause number="3.3">
              I hereby grant UPLOADER the permission to provide a copy of my ID Documents to any Platform, if so requested by such Platform, in connection with the Content and any requirements by applicable national, federal, state and local laws and regulations.
            </ContractClause>

            <ContractClause number="4">
              I hereby grant UPLOADER the permission to use, reproduce, sell, license, rent or otherwise distribute and publish, modify, edit and alter the Content, which permission is irrevocable. Furthermore, I hereby agree and authorize UPLOADER to publish the Content online, on the platform of the UPLOADER's choice, including any Web platform where independent content uploaders can upload, publish, license and sell their original adult videos, services or other tangible goods to final users and where such final users may download the Content, including all related subdomains or websites of such platform, and such authorization is given for an unlimited time.
            </ContractClause>

            <ContractClause number="5">
              I hereby understand and agree that the Content may be searchable by others through the Platform itself and through other partnered or networked entities of the Platform or UPLOADER. Furthermore, I understand and agree that the Content may be searchable by publicly available search engines, and it is my sole responsibility should I wish not to appear, be found, or be removed from such search engines.
            </ContractClause>

            <ContractClause number="6">
              If the Content is found on a website that has not been indicated by or that is not related to UPLOADER, or its licensees, as the case may be, I shall have full rights to demand that the Content be taken down from such unapproved website and/or destroyed, the whole at my own costs.
            </ContractClause>

            <ContractClause number="7">
              I fully understand and acknowledge that all of the Content is the sole property of UPLOADER and can be used under license by the Platform, and all films, audiotapes, videotapes, reproductions, media, plates, negatives, photocopies, and electronic and digital copies of the Content, are the property of UPLOADER.
            </ContractClause>

            <ContractClause number="8">
              I hereby represent and acknowledge that I am solely responsible for the nature of the Content in which I decide to participate in and that I am solely responsible to bear all risks associated with my participation in the Content. I will not participate in any content that could be deemed illegal or illicit, or involving minors. Furthermore, I agree not to participate in content that could violate third party intellectual copyright or that violates another individual's privacy or image.
            </ContractClause>

            <ContractClause number="9">
              I hereby release, discharge and undertake to indemnify and hold harmless UPLOADER and the Platform from and against any and all claims, liability, costs, losses, damages or injuries of any kind arising out of or related to my participation in the Content. Without limiting the generality of the foregoing, I agree that UPLOADER has neither made nor will be in any manner responsible or liable for any warranty, representation or guarantee, express or implied, in fact or in law, in connection with the Content or my participation in the Content. I further release all rights to bring any claim, action or proceeding against UPLOADER and the Platform.
            </ContractClause>

            <ContractClause number="10">
              I fully understand that the present declaration is binding upon my heirs and legal successors. This Agreement shall be binding upon, inure to the benefit of, and be enforceable by both UPLOADER and the Platform, and their respective successors and assigns.
            </ContractClause>

            <ContractClause number="11">
              I acknowledge that I have reviewed this Agreement in its entirety and understand its terms and, further, that I have had the opportunity to discuss and review the terms of this Agreement with my own counsel before signing. This Agreement shall be deemed to have been jointly drafted by me and UPLOADER, and in construing and interpreting this Agreement, no provision shall be construed and interpreted for or against any of the parties hereto because such provision or any other provision of the Agreement as a whole is purportedly prepared or requested by such party.
            </ContractClause>

            <ContractClause number="12">
              In the event that any provision or portion of this Agreement shall be determined to be invalid or unenforceable for any reason, in whole or in part, the remaining provisions of this Agreement shall be unaffected thereby and shall remain in full force and effect to the fullest extent permitted by law.
            </ContractClause>

            <ContractClause number="13">
              I agree and understand that I am solely responsible to comply with all applicable laws and regulations in my location as well as all laws and regulations applicable to my participation in the Content.
            </ContractClause>

            <ContractClause number="14">
              I swear that the foregoing is true and correct and that the ID Documents that I have provided were lawfully obtained by me and have not been altered in any way.
            </ContractClause>

            <ContractClause number="15">
              This Agreement may be executed by facsimile, electronic mail, or through the mail in two or more counterparts, and by the different parties hereto in separate counterparts, each of which when executed shall be deemed to be an original but all of which taken together shall constitute one and the same instrument.
            </ContractClause>

            <ContractClause number="16">
              This Agreement shall be governed by and construed in accordance with the laws of{" "}
              <strong>
                {
                  agreement.governingLaw ||
                  "____________________________"
                }
              </strong>
              . The parties irrevocably agree that the courts of{" "}
              <strong>
                {
                  agreement.jurisdiction ||
                  "____________________________"
                }
              </strong>{" "}
              shall have exclusive jurisdiction to settle any dispute or claim that arises out of or in connection with this Agreement or its subject matter or formation, including non-contractual disputes or claims.
            </ContractClause>

            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <div>
                <div className="font-bold">
                  CO-PERFORMER
                </div>
                <div className="mt-2">
                  Read and accepted this{" "}
                  <strong>
                    {
                      formatContractDate(
                        agreement.agreementDate,
                      )
                    }
                  </strong>
                </div>
                <div className="mt-8 border-t border-black pt-1">
                  Signature
                </div>
                <div className="mt-2">
                  {
                    agreement.coPerformerLegalName
                  }
                </div>
              </div>

              <div>
                <div className="font-bold">
                  UPLOADER
                </div>
                <div className="mt-2">
                  Read and accepted this{" "}
                  <strong>
                    {
                      formatContractDate(
                        agreement.agreementDate,
                      )
                    }
                  </strong>
                </div>
                <div className="mt-8 border-t border-black pt-1">
                  Signature
                </div>
                <div className="mt-2">
                  {
                    agreement.uploaderLegalName
                  }
                </div>
              </div>
            </div>

            <div className="mt-10 border-t border-neutral-300 pt-3 text-[9px] text-neutral-500">
              Internal preview · Contract ID: {
                agreement.id
              } · Status: {
                agreement.status
              }
            </div>
          </article>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-3">
          <div className="text-[9px] text-white/25">
            Preview only. PDF generation and signatures are not enabled yet.
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[10px] font-medium text-white/55 transition hover:bg-white/[0.06] hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ContractClause({
  number,
  children,
}: {
  number: string;
  children: React.ReactNode;
}) {
  return (
    <p className="mt-4">
      <strong>
        {number}.
      </strong>{" "}
      {children}
    </p>
  );
}

function formatContractDate(
  value: string,
) {
  if (!value) {
    return "________________";
  }

  const date =
    new Date(
      `${value}T12:00:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  );
}

function DocumentsPanel({
  title = "Documents",
  description = "Photo ID, proof of address, release forms, test results and other compliance files.",
  emptyTitle = "No documents yet",
  emptyDescription = "Add an ID, release form, proof of address or test result.",
  uploadButtonLabel = "Add document",
  submitButtonLabel = "Upload document",
  forcedDocumentType,
  documents,
  isLoading,
  isUploadOpen,
  isUploading,
  form,
  file,
  onOpenUpload,
  onCloseUpload,
  onFormChange,
  onFileChange,
  onSubmit,
  onOpenDocument,
  onRefresh,
}: {
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  uploadButtonLabel?: string;
  submitButtonLabel?: string;
  forcedDocumentType?: DocumentForm["documentType"];
  documents: PerformerDocument[];
  isLoading: boolean;
  isUploadOpen: boolean;
  isUploading: boolean;
  form: DocumentForm;
  file: File | null;
  onOpenUpload: () => void;
  onCloseUpload: () => void;
  onFormChange: (
    field: keyof DocumentForm,
    value: string,
  ) => void;
  onFileChange: (
    file: File | null,
  ) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
  onOpenDocument: (
    documentId: string,
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.018]">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-white/90">
            {title}
          </div>

          <div className="mt-1 text-[10px] text-white/30">
            {description}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void onRefresh()
            }
            disabled={
              isLoading
            }
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[10px] font-medium text-white/45 transition hover:bg-white/[0.05] hover:text-white/80 disabled:opacity-40"
          >
            <Loader2
              className={`h-3.5 w-3.5 ${
                isLoading
                  ? "animate-spin"
                  : ""
              }`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={
              onOpenUpload
            }
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-3.5 py-2 text-[10px] font-semibold text-white transition hover:brightness-110"
          >
            <Plus className="h-3.5 w-3.5" />
            {uploadButtonLabel}
          </button>
        </div>
      </div>

      {isUploadOpen && (
        <form
          onSubmit={
            onSubmit
          }
          className="border-b border-white/[0.06] bg-black/[0.08] px-5 py-5"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Field
              label={
                forcedDocumentType
                  ? "Record type"
                  : "Document type"
              }
              required
            >
              {forcedDocumentType ? (
                <div className="document-input flex items-center">
                  Test result / exam
                </div>
              ) : (
                <select
                  value={
                    form.documentType
                  }
                  onChange={(
                    event,
                  ) =>
                    onFormChange(
                      "documentType",
                      event.target.value,
                    )
                  }
                  className="document-input"
                >
                  <option value="PHOTO_ID">
                    Photo ID
                  </option>
                  <option value="PROOF_OF_ADDRESS">
                    Proof of address
                  </option>
                  <option value="RELEASE_FORM">
                    Release / consent form
                  </option>
                  <option value="OTHER">
                    Other
                  </option>
                </select>
              )}
            </Field>

            <Field label="Title">
              <input
                value={
                  form.title
                }
                onChange={(
                  event,
                ) =>
                  onFormChange(
                    "title",
                    event.target.value,
                  )
                }
                placeholder={
                  forcedDocumentType ===
                  "TEST_RESULT"
                    ? "e.g. Full panel test - Sep 2026"
                    : "e.g. California Driver License"
                }
                maxLength={
                  160
                }
                className="document-input"
              />
            </Field>

            <Field label="Document number">
              <input
                value={
                  form.documentNumber
                }
                onChange={(
                  event,
                ) =>
                  onFormChange(
                    "documentNumber",
                    event.target.value,
                  )
                }
                maxLength={
                  120
                }
                className="document-input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Issued">
                <input
                  type="date"
                  value={
                    form.issuedAt
                  }
                  onChange={(
                    event,
                  ) =>
                    onFormChange(
                      "issuedAt",
                      event.target.value,
                    )
                  }
                  className="document-input"
                />
              </Field>

              <Field label="Expires">
                <input
                  type="date"
                  value={
                    form.expiresAt
                  }
                  onChange={(
                    event,
                  ) =>
                    onFormChange(
                      "expiresAt",
                      event.target.value,
                    )
                  }
                  className="document-input"
                />
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field
                label="File"
                required
              >
                <label className="flex min-h-[86px] cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/[0.12] bg-[#0c1119] px-4 py-4 text-center transition hover:border-blue-400/30 hover:bg-blue-500/[0.025]">
                  <input
                    type="file"
                    accept=".pdf,.txt,.jpg,.jpeg,.png,application/pdf,text/plain,image/jpeg,image/png"
                    className="hidden"
                    onChange={(
                      event,
                    ) =>
                      onFileChange(
                        event.target
                          .files?.[0] ??
                          null,
                      )
                    }
                  />

                  <div>
                    <Upload className="mx-auto h-5 w-5 text-white/25" />
                    <div className="mt-2 text-[11px] font-medium text-white/55">
                      {file
                        ? file.name
                        : "Choose PDF, TXT, JPG or PNG"}
                    </div>
                    <div className="mt-1 text-[9px] text-white/25">
                      Maximum file size: 5 MB
                    </div>
                  </div>
                </label>
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field label="Notes">
                <textarea
                  value={
                    form.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    onFormChange(
                      "notes",
                      event.target.value,
                    )
                  }
                  rows={
                    3
                  }
                  maxLength={
                    2000
                  }
                  className="document-input resize-none"
                />
              </Field>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={
                isUploading
              }
              onClick={
                onCloseUpload
              }
              className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-[10px] font-medium text-white/45 transition hover:bg-white/[0.04] hover:text-white/70 disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                isUploading ||
                !file
              }
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2.5 text-[10px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {isUploading
                ? "Uploading..."
                : submitButtonLabel}
            </button>
          </div>
        </form>
      )}

      <div className="p-5">
        {isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-400" />
              <div className="mt-2 text-[10px] text-white/30">
                Loading documents...
              </div>
            </div>
          </div>
        ) : documents.length ===
          0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-black/[0.06] px-6 text-center">
            <FolderOpen className="h-7 w-7 text-white/18" />
            <div className="mt-3 text-xs font-semibold text-white/55">
              {emptyTitle}
            </div>
            <div className="mt-1 text-[10px] text-white/25">
              {emptyDescription}
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {documents.map(
              (document) => (
                <div
                  key={
                    document.id
                  }
                  className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-black/[0.07] p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-xs font-semibold text-white/80">
                        {
                          document.title
                        }
                      </div>

                      <span className="rounded-full border border-blue-500/15 bg-blue-500/[0.06] px-2 py-1 text-[8px] font-semibold text-blue-200">
                        {
                          documentTypeLabel(
                            document.documentType,
                          )
                        }
                      </span>

                      {documentStatus(
                        document,
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-white/27">
                      <span>
                        {
                          formatFileSize(
                            document.fileSize,
                          )
                        }
                      </span>

                      {document.documentNumber && (
                        <span>
                          No.{" "}
                          {
                            document.documentNumber
                          }
                        </span>
                      )}

                      {document.expiresAt && (
                        <span>
                          Expires{" "}
                          {
                            formatDate(
                              document.expiresAt,
                            )
                          }
                        </span>
                      )}

                      <span>
                        Added{" "}
                        {
                          formatDate(
                            document.createdAt,
                          )
                        }
                      </span>
                    </div>

                    {document.notes && (
                      <div className="mt-2 line-clamp-2 text-[9px] leading-4 text-white/22">
                        {
                          document.notes
                        }
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void onOpenDocument(
                        document.id,
                      )
                    }
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-[10px] font-medium text-white/50 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Open / download
                  </button>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .document-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: #0c1119;
          padding: 0.7rem 0.75rem;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.85);
          outline: none;
        }

        .document-input::placeholder {
          color: rgba(255, 255, 255, 0.18);
        }

        .document-input:focus {
          border-color: rgba(59, 130, 246, 0.35);
        }
      `}</style>
    </section>
  );
}

function documentTypeLabel(
  value: string,
) {
  switch (value) {
    case "PHOTO_ID":
      return "Photo ID";
    case "PROOF_OF_ADDRESS":
      return "Proof of address";
    case "RELEASE_FORM":
      return "Release form";
    case "TEST_RESULT":
      return "Test result";
    default:
      return "Other";
  }
}

function documentStatus(
  document: PerformerDocument,
) {
  if (
    !document.expiresAt
  ) {
    return (
      <span className="rounded-full border border-emerald-500/15 bg-emerald-500/[0.05] px-2 py-1 text-[8px] font-semibold text-emerald-300">
        Active
      </span>
    );
  }

  const expires =
    new Date(
      document.expiresAt,
    );

  const now =
    new Date();

  const days =
    Math.ceil(
      (
        expires.getTime() -
        now.getTime()
      ) /
        86_400_000,
    );

  if (days < 0) {
    return (
      <span className="rounded-full border border-red-500/20 bg-red-500/[0.06] px-2 py-1 text-[8px] font-semibold text-red-300">
        Expired
      </span>
    );
  }

  if (days <= 30) {
    return (
      <span className="rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1 text-[8px] font-semibold text-amber-300">
        Expiring soon
      </span>
    );
  }

  return (
    <span className="rounded-full border border-emerald-500/15 bg-emerald-500/[0.05] px-2 py-1 text-[8px] font-semibold text-emerald-300">
      Active
    </span>
  );
}

function formatFileSize(
  bytes: number,
) {
  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[11px] font-medium transition ${
        active
          ? "border-blue-500/35 bg-blue-500/[0.08] text-blue-200"
          : "border-white/[0.07] bg-white/[0.018] text-white/35 hover:bg-white/[0.035] hover:text-white/70"
      }`}
    >
      {
        icon
      }
      {
        label
      }
    </button>
  );
}

function ComingSoonPanel({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[330px] flex-col items-center justify-center rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.012] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.025] text-white/20">
        {
          icon
        }
      </div>

      <div className="mt-4 text-sm font-semibold text-white/65">
        {
          title
        }
      </div>

      <div className="mt-2 max-w-lg text-[11px] leading-5 text-white/27">
        {
          description
        }
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-medium text-white/40">
        {
          label
        }

        {required && (
          <span className="ml-1 text-blue-300">
            *
          </span>
        )}
      </span>

      {
        children
      }
    </label>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const active =
    status === "ACTIVE";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[8px] font-semibold ${
        active
          ? "border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-300"
          : "border-white/[0.08] bg-white/[0.025] text-white/35"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active
            ? "bg-emerald-400"
            : "bg-white/25"
        }`}
      />

      {active
        ? "Active"
        : "Inactive"}
    </span>
  );
}

function formatDate(
  value: string,
) {
  const parsed =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
    },
  ).format(
    parsed,
  );
}
