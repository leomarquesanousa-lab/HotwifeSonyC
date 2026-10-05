"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import {
  CheckCircle2,
  CircleAlert,
  FileText,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

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

type PerformersResponse = {
  success: boolean;
  performers?: Performer[];
  error?: string;
  message?: string;
};

type CreatePerformerResponse = {
  success: boolean;
  performer?: Performer;
  error?: string;
  message?: string;
};

type PerformerFilter =
  | "ALL"
  | "ACTIVE"
  | "INACTIVE";

type PerformerForm = {
  displayName: string;
  legalName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  status: "ACTIVE" | "INACTIVE";
  notes: string;
};

const EMPTY_FORM: PerformerForm = {
  displayName: "",
  legalName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  status: "ACTIVE",
  notes: "",
};

const translations = {
  "en-US": {
    title: "Performers",
    subtitle:
      "Manage performersLabel, compliance information, documents and content relationships.",
    addPerformer: "Add performer",
    totalPerformers: "Total performersLabel",
    active: "Active",
    inactive: "Inactive",
    all: "All",
    searchPerformers: "Search performersLabel...",
    refresh: "Refresh",
    loadingPerformers: "Loading performersLabel...",
    noPerformersFound: "No performersLabel found",
    noPerformersDescription:
      "Add your first performer to start organizing compliance documents and related content.",
    showing: "Showing",
    of: "of",
    performersLabel: "performersLabel",
    legalNameNotAdded: "Legal name not added",
    noEmail: "No email",
    noPhone: "No phone",
    dateOfBirthNotAdded: "Date of birth not added",
    dob: "DOB",
    added: "Added",
    openProfile: "Open profile",
    modalDescription:
      "Create a performer profile for compliance, documents and media relationships.",
    displayName: "Display name",
    legalName: "Legal name",
    email: "Email",
    phone: "Phone",
    dateOfBirth: "Date of birth",
    status: "Status",
    notes: "Notes",
    displayNamePlaceholder: "e.g. Maria",
    legalNamePlaceholder: "Full legal name",
    emailPlaceholder: "name@example.com",
    phonePlaceholder: "+1 555 123 4567",
    notesPlaceholder: "Internal notes about this performer...",
    cancel: "Cancel",
    saving: "Saving...",
    close: "Close",
    displayNameRequired: "Display name is required.",
    loadError: "Unable to load performersLabel.",
    createError: "Unable to create performer.",
    addedSuccessfully: "added successfully.",
  },

  "pt-BR": {
    title: "Performers",
    subtitle:
      "Gerencie performers, informações de conformidade, documentos e relações de conteúdo.",
    addPerformer: "Adicionar performer",
    totalPerformers: "Total de performers",
    active: "Ativos",
    inactive: "Inativos",
    all: "Todos",
    searchPerformers: "Buscar performers...",
    refresh: "Atualizar",
    loadingPerformers: "Carregando performers...",
    noPerformersFound: "Nenhum performer encontrado",
    noPerformersDescription:
      "Adicione seu primeiro performer para começar a organizar documentos de conformidade e conteúdos relacionados.",
    showing: "Mostrando",
    of: "de",
    performersLabel: "performers",
    legalNameNotAdded: "Nome legal não adicionado",
    noEmail: "Sem e-mail",
    noPhone: "Sem telefone",
    dateOfBirthNotAdded: "Data de nascimento não adicionada",
    dob: "Nascimento",
    added: "Adicionado em",
    openProfile: "Abrir perfil",
    modalDescription:
      "Crie um perfil de performer para organizar conformidade, documentos e relações de mídia.",
    displayName: "Nome de exibição",
    legalName: "Nome legal",
    email: "E-mail",
    phone: "Telefone",
    dateOfBirth: "Data de nascimento",
    status: "Status",
    notes: "Observações",
    displayNamePlaceholder: "Ex.: Maria",
    legalNamePlaceholder: "Nome legal completo",
    emailPlaceholder: "nome@exemplo.com",
    phonePlaceholder: "+55 11 99999-9999",
    notesPlaceholder: "Observações internas sobre este performer...",
    cancel: "Cancelar",
    saving: "Salvando...",
    close: "Fechar",
    displayNameRequired: "O nome de exibição é obrigatório.",
    loadError: "Não foi possível carregar os performers.",
    createError: "Não foi possível adicionar o performer.",
    addedSuccessfully: "foi adicionado com sucesso.",
  },

  "es-ES": {
    title: "Performers",
    subtitle:
      "Gestiona performers, información de cumplimiento, documentos y relaciones de contenido.",
    addPerformer: "Añadir performer",
    totalPerformers: "Total de performers",
    active: "Activos",
    inactive: "Inactivos",
    all: "Todos",
    searchPerformers: "Buscar performers...",
    refresh: "Actualizar",
    loadingPerformers: "Cargando performers...",
    noPerformersFound: "No se encontraron performers",
    noPerformersDescription:
      "Añade tu primer performer para comenzar a organizar documentos de cumplimiento y contenido relacionado.",
    showing: "Mostrando",
    of: "de",
    performersLabel: "performers",
    legalNameNotAdded: "Nombre legal no añadido",
    noEmail: "Sin correo electrónico",
    noPhone: "Sin teléfono",
    dateOfBirthNotAdded: "Fecha de nacimiento no añadida",
    dob: "Nacimiento",
    added: "Añadido",
    openProfile: "Abrir perfil",
    modalDescription:
      "Crea un perfil de performer para cumplimiento, documentos y relaciones de contenido.",
    displayName: "Nombre para mostrar",
    legalName: "Nombre legal",
    email: "Correo electrónico",
    phone: "Teléfono",
    dateOfBirth: "Fecha de nacimiento",
    status: "Estado",
    notes: "Notas",
    displayNamePlaceholder: "Ej.: Maria",
    legalNamePlaceholder: "Nombre legal completo",
    emailPlaceholder: "nombre@ejemplo.com",
    phonePlaceholder: "+34 600 000 000",
    notesPlaceholder: "Notas internas sobre este performer...",
    cancel: "Cancelar",
    saving: "Guardando...",
    close: "Cerrar",
    displayNameRequired: "El nombre para mostrar es obligatorio.",
    loadError: "No se pudieron cargar los performers.",
    createError: "No se pudo añadir el performer.",
    addedSuccessfully: "se añadió correctamente.",
  },

  "fr-FR": {
    title: "Performers",
    subtitle:
      "Gérez les performers, les informations de conformité, les documents et les relations de contenu.",
    addPerformer: "Ajouter un performer",
    totalPerformers: "Total des performers",
    active: "Actifs",
    inactive: "Inactifs",
    all: "Tous",
    searchPerformers: "Rechercher des performers...",
    refresh: "Actualiser",
    loadingPerformers: "Chargement des performers...",
    noPerformersFound: "Aucun performer trouvé",
    noPerformersDescription:
      "Ajoutez votre premier performer pour commencer à organiser les documents de conformité et le contenu associé.",
    showing: "Affichage de",
    of: "sur",
    performersLabel: "performers",
    legalNameNotAdded: "Nom légal non renseigné",
    noEmail: "Aucun e-mail",
    noPhone: "Aucun téléphone",
    dateOfBirthNotAdded: "Date de naissance non renseignée",
    dob: "Naissance",
    added: "Ajouté",
    openProfile: "Ouvrir le profil",
    modalDescription:
      "Créez un profil de performer pour la conformité, les documents et les relations de contenu.",
    displayName: "Nom d'affichage",
    legalName: "Nom légal",
    email: "E-mail",
    phone: "Téléphone",
    dateOfBirth: "Date de naissance",
    status: "Statut",
    notes: "Notes",
    displayNamePlaceholder: "Ex. : Maria",
    legalNamePlaceholder: "Nom légal complet",
    emailPlaceholder: "nom@exemple.com",
    phonePlaceholder: "+33 6 00 00 00 00",
    notesPlaceholder: "Notes internes sur ce performer...",
    cancel: "Annuler",
    saving: "Enregistrement...",
    close: "Fermer",
    displayNameRequired: "Le nom d'affichage est obligatoire.",
    loadError: "Impossible de charger les performers.",
    createError: "Impossible d'ajouter le performer.",
    addedSuccessfully: "a été ajouté avec succès.",
  },

  "cs-CZ": {
    title: "Performers",
    subtitle:
      "Spravujte performers, informace o souladu, dokumenty a vztahy k obsahu.",
    addPerformer: "Přidat performera",
    totalPerformers: "Celkem performerů",
    active: "Aktivní",
    inactive: "Neaktivní",
    all: "Všichni",
    searchPerformers: "Hledat performery...",
    refresh: "Obnovit",
    loadingPerformers: "Načítání performerů...",
    noPerformersFound: "Nebyli nalezeni žádní performeři",
    noPerformersDescription:
      "Přidejte prvního performera a začněte organizovat dokumenty a související obsah.",
    showing: "Zobrazeno",
    of: "z",
    performersLabel: "performerů",
    legalNameNotAdded: "Právní jméno nebylo přidáno",
    noEmail: "Bez e-mailu",
    noPhone: "Bez telefonu",
    dateOfBirthNotAdded: "Datum narození nebylo přidáno",
    dob: "Narození",
    added: "Přidáno",
    openProfile: "Otevřít profil",
    modalDescription:
      "Vytvořte profil performera pro dokumenty, soulad a vztahy k médiím.",
    displayName: "Zobrazované jméno",
    legalName: "Právní jméno",
    email: "E-mail",
    phone: "Telefon",
    dateOfBirth: "Datum narození",
    status: "Stav",
    notes: "Poznámky",
    displayNamePlaceholder: "Např. Maria",
    legalNamePlaceholder: "Celé právní jméno",
    emailPlaceholder: "jmeno@example.com",
    phonePlaceholder: "+420 600 000 000",
    notesPlaceholder: "Interní poznámky k tomuto performerovi...",
    cancel: "Zrušit",
    saving: "Ukládání...",
    close: "Zavřít",
    displayNameRequired: "Zobrazované jméno je povinné.",
    loadError: "Performery se nepodařilo načíst.",
    createError: "Performera se nepodařilo přidat.",
    addedSuccessfully: "byla úspěšně přidána.",
  },
} as const;

type SupportedLocale =
  keyof typeof translations;

export default function PerformersPage() {
  const params =
    useParams<{
      locale: string;
    }>();

  const locale =
    params.locale || "en-US";

  const supportedLocale: SupportedLocale =
    locale in translations
      ? (locale as SupportedLocale)
      : "en-US";

  const t =
    translations[supportedLocale];

  const [
    performers,
    setPerformers,
  ] = useState<Performer[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    pageSuccess,
    setPageSuccess,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState<PerformerFilter>(
    "ALL",
  );

  const [
    isCreateOpen,
    setIsCreateOpen,
  ] = useState(false);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState<PerformerForm>(
    EMPTY_FORM,
  );

  const loadPerformers =
    useCallback(async () => {
      try {
        setIsLoading(true);
        setPageError("");

        const response =
          await fetch(
            "/api/performers",
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const data =
          (await response.json()) as PerformersResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              data.error ||
              t.loadError,
          );
        }

        setPerformers(
          data.performers ?? [],
        );
      } catch (error) {
        console.error(
          "PERFORMERS_LOAD_ERROR",
          error,
        );

        setPageError(
          error instanceof Error
            ? error.message
            : t.loadError,
        );
      } finally {
        setIsLoading(false);
      }
    }, [t.loadError]);

  useEffect(() => {
    void loadPerformers();
  }, [loadPerformers]);

  const activeCount =
    useMemo(
      () =>
        performers.filter(
          (performer) =>
            performer.status ===
            "ACTIVE",
        ).length,
      [performers],
    );

  const inactiveCount =
    useMemo(
      () =>
        performers.filter(
          (performer) =>
            performer.status ===
            "INACTIVE",
        ).length,
      [performers],
    );

  const filteredPerformers =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return performers.filter(
        (performer) => {
          if (
            filter !== "ALL" &&
            performer.status !== filter
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const haystack = [
            performer.displayName,
            performer.legalName,
            performer.email,
            performer.phone,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            query,
          );
        },
      );
    }, [
      filter,
      performers,
      search,
    ]);

  function openCreateModal() {
    setForm(EMPTY_FORM);
    setPageError("");
    setPageSuccess("");
    setIsCreateOpen(true);
  }

  function closeCreateModal() {
    if (isSaving) {
      return;
    }

    setIsCreateOpen(false);
    setForm(EMPTY_FORM);
  }

  function updateForm(
    field: keyof PerformerForm,
    value: string,
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );
  }

  async function createPerformer(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const displayName =
      form.displayName.trim();

    if (!displayName) {
      setPageError(
        t.displayNameRequired,
      );
      return;
    }

    try {
      setIsSaving(true);
      setPageError("");
      setPageSuccess("");

      const response =
        await fetch(
          "/api/performers",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                displayName,
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
        (await response.json()) as CreatePerformerResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.performer
      ) {
        throw new Error(
          data.message ||
            data.error ||
            t.createError,
        );
      }

      setPageSuccess(
        `${data.performer.displayName} ${t.addedSuccessfully}`,
      );

      setIsCreateOpen(false);
      setForm(EMPTY_FORM);

      await loadPerformers();
    } catch (error) {
      console.error(
        "PERFORMER_CREATE_ERROR",
        error,
      );

      setPageError(
        error instanceof Error
          ? error.message
          : t.createError,
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <div className="mx-auto w-full max-w-[1540px] px-5 py-6 sm:px-7 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
              <UsersRound className="h-4.5 w-4.5 text-blue-300" />
            </div>

            <div>
              <h1 className="text-[28px] font-semibold tracking-[-0.04em]">
                {t.title}
              </h1>

              <p className="mt-0.5 text-xs text-white/35">
                {t.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.16)] transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            {t.addPerformer}
          </button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <StatCard
            label={t.totalPerformers}
            value={performers.length}
            tone="blue"
          />

          <StatCard
            label={t.active}
            value={activeCount}
            tone="green"
          />

          <StatCard
            label={t.inactive}
            value={inactiveCount}
            tone="gray"
          />
        </div>

        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterButton
              active={filter === "ALL"}
              onClick={() =>
                setFilter("ALL")
              }
              label={t.all}
              count={performers.length}
            />

            <FilterButton
              active={
                filter === "ACTIVE"
              }
              onClick={() =>
                setFilter("ACTIVE")
              }
              label={t.active}
              count={activeCount}
            />

            <FilterButton
              active={
                filter === "INACTIVE"
              }
              onClick={() =>
                setFilter("INACTIVE")
              }
              label={t.inactive}
              count={inactiveCount}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-[260px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder={
                  t.searchPerformers
                }
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.025] py-2 pl-8 pr-3 text-[11px] text-white outline-none placeholder:text-white/20 focus:border-blue-500/30"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                void loadPerformers()
              }
              disabled={isLoading}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[11px] text-white/45 transition hover:text-white disabled:opacity-40"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  isLoading
                    ? "animate-spin"
                    : ""
                }`}
              />

              {t.refresh}
            </button>
          </div>
        </div>

        {pageSuccess && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-xs text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {pageSuccess}
          </div>
        )}

        {pageError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs text-red-300">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {pageError}
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-400" />

              <div className="mt-3 text-xs text-white/30">
                {t.loadingPerformers}
              </div>
            </div>
          </div>
        ) : filteredPerformers.length ===
          0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.015] px-6 text-center">
            <UsersRound className="h-8 w-8 text-white/20" />

            <div className="mt-3 text-sm font-medium text-white/60">
              {t.noPerformersFound}
            </div>

            <div className="mt-1 max-w-md text-xs text-white/25">
              {t.noPerformersDescription}
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-500/12 px-3 py-2 text-[11px] font-semibold text-blue-300 transition hover:bg-blue-500/20"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.addPerformer}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPerformers.map(
              (performer) => (
                <PerformerCard
                  key={performer.id}
                  performer={
                    performer
                  }
                  locale={locale}
                  t={t}
                />
              ),
            )}
          </div>
        )}

        {!isLoading &&
          filteredPerformers.length >
            0 && (
            <div className="mt-6 text-[11px] text-white/20">
              {t.showing}{" "}
              {
                filteredPerformers.length
              }{" "}
              {t.of}{" "}
              {performers.length}{" "}
              {t.performersLabel}
            </div>
          )}
      </div>

      {isCreateOpen && (
        <CreatePerformerModal
          form={form}
          isSaving={isSaving}
          onChange={updateForm}
          onClose={
            closeCreateModal
          }
          onSubmit={
            createPerformer
          }
          t={t}
        />
      )}
    </main>
  );
}

function PerformerCard({
  performer,
  locale,
  t,
}: {
  performer: Performer;
  locale: string;
  t: (typeof translations)[SupportedLocale];
}) {
  const initial =
    performer.displayName
      .trim()
      .charAt(0)
      .toUpperCase() || "?";

  return (
    <article className="overflow-hidden rounded-[16px] border border-white/[0.08] bg-white/[0.018] shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition hover:border-white/[0.13] hover:bg-white/[0.025]">
      <div className="px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/15 bg-blue-500/[0.07] text-sm font-semibold text-blue-200">
            {initial}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-white/90">
              {
                performer.displayName
              }
            </div>

            <div className="mt-1 truncate text-[10px] text-white/30">
              {performer.legalName ||
                t.legalNameNotAdded}
            </div>
          </div>

          <StatusBadge
            status={
              performer.status
            }
            t={t}
          />
        </div>

        <div className="mt-4 space-y-2">
          <InfoRow
            icon={
              <Mail className="h-3.5 w-3.5" />
            }
            value={
              performer.email ||
              t.noEmail
            }
          />

          <InfoRow
            icon={
              <Phone className="h-3.5 w-3.5" />
            }
            value={
              performer.phone ||
              t.noPhone
            }
          />

          <InfoRow
            icon={
              <UserRound className="h-3.5 w-3.5" />
            }
            value={
              performer.dateOfBirth
                ? `${t.dob} ${formatDateOnly(
                    performer.dateOfBirth,
                    locale,
                  )}`
                : t.dateOfBirthNotAdded
            }
          />
        </div>

        {performer.notes && (
          <div className="mt-4 line-clamp-2 rounded-xl border border-white/[0.06] bg-black/[0.08] px-3 py-2 text-[10px] leading-5 text-white/35">
            {performer.notes}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] bg-black/[0.08] px-3 py-2.5">
        <div className="text-[9px] text-white/20">
          {t.added}{" "}
          {formatDateTime(
            performer.createdAt,
            locale,
          )}
        </div>

        <Link
          href={`/app/performers/${performer.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-2.5 text-[9px] font-medium text-blue-300 transition hover:border-blue-500/35 hover:bg-blue-500/[0.1] hover:text-blue-200"
        >
          <FileText className="h-3 w-3" />
          {t.openProfile}
        </Link>
      </div>
    </article>
  );
}

function InfoRow({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-[10px] text-white/35">
      <span className="shrink-0 text-white/20">
        {icon}
      </span>

      <span className="truncate">
        {value}
      </span>
    </div>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (typeof translations)[SupportedLocale];
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
        ? t.active
        : t.inactive}
    </span>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
        active
          ? "border-blue-500/40 bg-blue-500/[0.08] text-white"
          : "border-white/[0.08] bg-white/[0.02] text-white/45 hover:text-white"
      }`}
    >
      <UsersRound className="h-3.5 w-3.5" />

      <span className="text-[11px] font-medium">
        {label}
      </span>

      <span className="text-[10px] text-white/30">
        {count}
      </span>
    </button>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone:
    | "blue"
    | "green"
    | "gray";
}) {
  const classes = {
    blue:
      "border-blue-500/15 bg-blue-500/[0.035]",
    green:
      "border-emerald-500/15 bg-emerald-500/[0.035]",
    gray:
      "border-white/[0.07] bg-white/[0.018]",
  }[tone];

  return (
    <div
      className={`rounded-[16px] border px-4 py-3 ${classes}`}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/25">
        {label}
      </div>

      <div className="mt-1 text-xl font-semibold tracking-[-0.03em] text-white/85">
        {value}
      </div>
    </div>
  );
}

function CreatePerformerModal({
  form,
  isSaving,
  onChange,
  onClose,
  onSubmit,
  t,
}: {
  form: PerformerForm;
  isSaving: boolean;
  onChange: (
    field: keyof PerformerForm,
    value: string,
  ) => void;
  onClose: () => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
  t: (typeof translations)[SupportedLocale];
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-[680px] overflow-hidden rounded-[22px] border border-white/[0.1] bg-[#090d14] shadow-[0_35px_120px_rgba(0,0,0,0.75)]">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-white/90">
              {t.addPerformer}
            </div>

            <div className="mt-1 text-[10px] text-white/30">
              {t.modalDescription}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-white/40 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
            aria-label={t.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="max-h-[72vh] overflow-y-auto px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={
                  t.displayName
                }
                required
              >
                <input
                  value={
                    form.displayName
                  }
                  onChange={(event) =>
                    onChange(
                      "displayName",
                      event.target.value,
                    )
                  }
                  maxLength={120}
                  placeholder={
                    t.displayNamePlaceholder
                  }
                  className="input-field"
                />
              </Field>

              <Field
                label={t.legalName}
              >
                <input
                  value={
                    form.legalName
                  }
                  onChange={(event) =>
                    onChange(
                      "legalName",
                      event.target.value,
                    )
                  }
                  maxLength={160}
                  placeholder={
                    t.legalNamePlaceholder
                  }
                  className="input-field"
                />
              </Field>

              <Field
                label={t.email}
              >
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    onChange(
                      "email",
                      event.target.value,
                    )
                  }
                  maxLength={254}
                  placeholder={
                    t.emailPlaceholder
                  }
                  className="input-field"
                />
              </Field>

              <Field
                label={t.phone}
              >
                <input
                  value={form.phone}
                  onChange={(event) =>
                    onChange(
                      "phone",
                      event.target.value,
                    )
                  }
                  maxLength={40}
                  placeholder={
                    t.phonePlaceholder
                  }
                  className="input-field"
                />
              </Field>

              <Field
                label={
                  t.dateOfBirth
                }
              >
                <input
                  type="date"
                  value={
                    form.dateOfBirth
                  }
                  onChange={(event) =>
                    onChange(
                      "dateOfBirth",
                      event.target.value,
                    )
                  }
                  className="input-field"
                />
              </Field>

              <Field
                label={t.status}
              >
                <select
                  value={form.status}
                  onChange={(event) =>
                    onChange(
                      "status",
                      event.target.value,
                    )
                  }
                  className="input-field"
                >
                  <option value="ACTIVE">
                    {t.active}
                  </option>

                  <option value="INACTIVE">
                    {t.inactive}
                  </option>
                </select>
              </Field>
            </div>

            <div className="mt-4">
              <Field
                label={t.notes}
              >
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    onChange(
                      "notes",
                      event.target.value,
                    )
                  }
                  maxLength={4000}
                  rows={4}
                  placeholder={
                    t.notesPlaceholder
                  }
                  className="input-field resize-none"
                />
              </Field>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-black/[0.08] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-white/[0.08] px-4 py-2 text-[11px] font-medium text-white/45 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
            >
              {t.cancel}
            </button>

            <button
              type="submit"
              disabled={
                isSaving ||
                !form.displayName.trim()
              }
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2 text-[11px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}

              {isSaving
                ? t.saving
                : t.addPerformer}
            </button>
          </div>
        </form>

        <style jsx>{`
          .input-field {
            width: 100%;
            border-radius: 0.75rem;
            border: 1px solid
              rgba(255, 255, 255, 0.08);
            background: #0c1119;
            padding: 0.65rem 0.75rem;
            font-size: 0.75rem;
            color: rgba(
              255,
              255,
              255,
              0.85
            );
            outline: none;
          }

          .input-field::placeholder {
            color: rgba(
              255,
              255,
              255,
              0.18
            );
          }

          .input-field:focus {
            border-color: rgba(
              59,
              130,
              246,
              0.35
            );
          }
        `}</style>
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
        {label}

        {required && (
          <span className="ml-1 text-blue-300">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

function formatDateOnly(
  value: string,
  locale: string,
) {
  const parsed =
    new Date(
      `${value}T00:00:00`,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
    },
  ).format(parsed);
}

function formatDateTime(
  value: string,
  locale: string,
) {
  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
    },
  ).format(parsed);
}