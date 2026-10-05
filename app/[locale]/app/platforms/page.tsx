"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Check,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Globe2,
  Loader2,
  LockKeyhole,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

import {
  useParams,
  useSearchParams,
} from "next/navigation";

import * as SimpleIcons from "simple-icons";

type PlatformAccount = {
  id: string;
  creatorId: string | null;
  platform: string;
  platformName: string;
  status: string;
  externalAccountId: string | null;
  externalUsername: string | null;
  externalDisplayName: string | null;
  connectionType: string | null;
  lastVerifiedAt: string | null;
  lastSyncAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

type PlatformItem = {
  code: string;
  name: string;
  description: string;
  connectionMethod: string;
  availability: string;
  officialApi: boolean;
  colorHint: string;
  accounts: PlatformAccount[];
  connected: boolean;
};

type PlatformsResponse = {
  success: boolean;
  connectedCount: number;
  platforms: PlatformItem[];
};

type SimpleIcon = {
  title: string;
  slug: string;
  hex: string;
  path: string;
};

type PlatformFilter =
  | "ALL"
  | "CONNECTED"
  | "AVAILABLE"
  | "COMING_SOON";

const PLATFORM_DISPLAY_ORDER = [
  "INSTAGRAM",
  "FANVUE",
  "FACEBOOK",
  "MANYVIDS",
  "X",
  "REDDIT",
  "PORNHUB",
  "ONLYFANS",
  "FANSLY",
  "MYM",
  "LOYALFANS",
];

const FALLBACK_PLATFORMS:
  PlatformItem[] = [
    {
      code: "INSTAGRAM",
      name: "Instagram",
      description:
        "Publish Reels and creator content through the official Instagram API.",
      connectionMethod:
        "OAUTH",
      availability:
        "AVAILABLE",
      officialApi: true,
      colorHint: "pink",
      accounts: [],
      connected: false,
    },
    {
      code: "FANVUE",
      name: "Fanvue",
      description:
        "Connect your Fanvue creator account and authorize platform access.",
      connectionMethod:
        "OAUTH",
      availability:
        "AVAILABLE",
      officialApi: true,
      colorHint: "violet",
      accounts: [],
      connected: false,
    },
    {
      code: "FACEBOOK",
      name: "Facebook",
      description:
        "Connect Facebook Pages for centralized publishing and management.",
      connectionMethod:
        "OAUTH",
      availability:
        "AVAILABLE",
      officialApi: true,
      colorHint: "blue",
      accounts: [],
      connected: false,
    },
    {
      code: "MANYVIDS",
      name: "ManyVids",
      description:
        "Connect and distribute creator content to ManyVids.",
      connectionMethod:
        "PENDING",
      availability:
        "INTEGRATION_PENDING",
      officialApi: false,
      colorHint: "pink",
      accounts: [],
      connected: false,
    },
    {
      code: "X",
      name: "X",
      description:
        "Connect an X account for publishing and content distribution.",
      connectionMethod:
        "OAUTH",
      availability:
        "INTEGRATION_PENDING",
      officialApi: true,
      colorHint: "slate",
      accounts: [],
      connected: false,
    },
    {
      code: "REDDIT",
      name: "Reddit",
      description:
        "Connect Reddit for publishing into authorized communities.",
      connectionMethod:
        "OAUTH",
      availability:
        "INTEGRATION_PENDING",
      officialApi: true,
      colorHint: "orange",
      accounts: [],
      connected: false,
    },
    {
      code: "PORNHUB",
      name: "Pornhub",
      description:
        "Prepare creator video distribution for Pornhub.",
      connectionMethod:
        "PENDING",
      availability:
        "INTEGRATION_PENDING",
      officialApi: false,
      colorHint: "orange",
      accounts: [],
      connected: false,
    },
    {
      code: "ONLYFANS",
      name: "OnlyFans",
      description:
        "Manage creator content from the same centralized workspace.",
      connectionMethod:
        "PENDING",
      availability:
        "INTEGRATION_PENDING",
      officialApi: false,
      colorHint: "cyan",
      accounts: [],
      connected: false,
    },
    {
      code: "FANSLY",
      name: "Fansly",
      description:
        "Centralize creator publishing and content distribution workflows.",
      connectionMethod:
        "PENDING",
      availability:
        "INTEGRATION_PENDING",
      officialApi: false,
      colorHint: "blue",
      accounts: [],
      connected: false,
    },
    {
      code: "MYM",
      name: "MYM",
      description:
        "Prepare creator content for streamlined publishing and management.",
      connectionMethod:
        "PENDING",
      availability:
        "INTEGRATION_PENDING",
      officialApi: false,
      colorHint: "purple",
      accounts: [],
      connected: false,
    },
    {
      code: "LOYALFANS",
      name: "LoyalFans",
      description:
        "Extend your publishing workflow to LoyalFans.",
      connectionMethod:
        "PENDING",
      availability:
        "INTEGRATION_PENDING",
      officialApi: false,
      colorHint: "rose",
      accounts: [],
      connected: false,
    },
  ];


const UI = {
  "en-US": {
    title: "Platforms",
    subtitle: "Connect and manage every destination from one workspace.",
    refreshConnections: "Refresh connections",
    total: "Total",
    connected: "Connected",
    ready: "Ready",
    comingSoon: "Coming soon",
    all: "All",
    readyToConnect: "Ready to connect",
    searchPlatforms: "Search platforms...",
    loadingPlatforms: "Loading platforms...",
    noPlatformsFound: "No platforms found",
    changeFilterSearch: "Change your filter or search.",
    securityNote: "Connection credentials are stored securely and are only used by server-side integrations.",
    connectedAccount: "Connected account",
    integrationPending: "Integration pending",
    connecting: "Connecting...",
    connect: "Connect",
    available: "Available",
    soon: "Soon",
    loadError: "Unable to load platform connections.",
    serverError: "Unable to connect to the server.",
    unavailableSuffix: "connection is not available yet.",
    facebookConnected: "Facebook connected and verified successfully.",
    instagramConnected: "Instagram connected and verified successfully.",
    fanvueConnected: "Fanvue connected and verified successfully.",
    authCancelled: "Authorization was cancelled or denied.",
    secureVerificationFailed: "The connection could not be verified securely. Please try again.",
    missingCode: "The platform did not return an authorization code.",
    creatorMissing: "The creator associated with this connection could not be identified.",
    creatorNotFound: "The selected creator could not be found.",
    workspaceMissing: "The workspace associated with this connection could not be identified.",
    configurationIncomplete: "The integration configuration is incomplete.",
    noFacebookPages: "Authorization succeeded, but no manageable Facebook Page was found.",
    tokenExchangeFailed: "Authorization succeeded, but the token exchange failed.",
    longTokenFailed: "Connected, but the long-lived access token could not be generated.",
    pagesFetchFailed: "Connected, but the system could not read the available Facebook Pages.",
    tokenEncryptionFailed: "Connected, but the secure credential could not be stored.",
    missingAccessToken: "The platform did not return a valid access token.",
    profileCheckFailed: "The account could not be verified after authorization.",
    invalidProfile: "The platform returned an invalid account profile.",
    secureSessionExpired: "The secure connection session expired. Please try again.",
    internalError: "An internal error occurred while connecting the platform.",
    genericConnectError: "Unable to connect. Please try again.",
    connectedAccounts: "Connected accounts",
    connectAnotherInstagram: "Connect another Instagram",
    displayName: "Display name",
    addDisplayName: "Add display name",
    editDisplayName: "Edit display name",
    displayNamePlaceholder: "Example: João Instagram 1",
    displayNameHelp: "Use a friendly name so this account is easy to identify when publishing.",
    save: "Save",
    cancel: "Cancel",
    saving: "Saving...",
    displayNameSaved: "Display name saved.",
    displayNameSaveError: "Unable to save the display name.",
  },
  "pt-BR": {
    title: "Plataformas",
    subtitle: "Conecte e gerencie todos os destinos em um só lugar.",
    refreshConnections: "Atualizar conexões",
    total: "Total",
    connected: "Conectadas",
    ready: "Prontas",
    comingSoon: "Em breve",
    all: "Todas",
    readyToConnect: "Prontas para conectar",
    searchPlatforms: "Buscar plataformas...",
    loadingPlatforms: "Carregando plataformas...",
    noPlatformsFound: "Nenhuma plataforma encontrada",
    changeFilterSearch: "Altere o filtro ou a busca.",
    securityNote: "As credenciais de conexão são armazenadas com segurança e usadas somente pelas integrações do servidor.",
    connectedAccount: "Conta conectada",
    integrationPending: "Integração pendente",
    connecting: "Conectando...",
    connect: "Conectar",
    available: "Disponível",
    soon: "Em breve",
    loadError: "Não foi possível carregar as conexões das plataformas.",
    serverError: "Não foi possível conectar ao servidor.",
    unavailableSuffix: "ainda não está disponível para conexão.",
    facebookConnected: "Facebook conectado e verificado com sucesso.",
    instagramConnected: "Instagram conectado e verificado com sucesso.",
    fanvueConnected: "Fanvue conectado e verificado com sucesso.",
    authCancelled: "A autorização foi cancelada ou negada.",
    secureVerificationFailed: "Não foi possível verificar a conexão com segurança. Tente novamente.",
    missingCode: "A plataforma não retornou um código de autorização.",
    creatorMissing: "Não foi possível identificar o criador associado a esta conexão.",
    creatorNotFound: "O criador selecionado não foi encontrado.",
    workspaceMissing: "Não foi possível identificar o workspace associado a esta conexão.",
    configurationIncomplete: "A configuração da integração está incompleta.",
    noFacebookPages: "A autorização foi concluída, mas nenhuma Página do Facebook gerenciável foi encontrada.",
    tokenExchangeFailed: "A autorização foi concluída, mas a troca do token falhou.",
    longTokenFailed: "A conexão foi feita, mas não foi possível gerar o token de longa duração.",
    pagesFetchFailed: "A conexão foi feita, mas o sistema não conseguiu ler as Páginas do Facebook disponíveis.",
    tokenEncryptionFailed: "A conexão foi feita, mas não foi possível armazenar a credencial com segurança.",
    missingAccessToken: "A plataforma não retornou um token de acesso válido.",
    profileCheckFailed: "Não foi possível verificar a conta após a autorização.",
    invalidProfile: "A plataforma retornou um perfil de conta inválido.",
    secureSessionExpired: "A sessão segura de conexão expirou. Tente novamente.",
    internalError: "Ocorreu um erro interno ao conectar a plataforma.",
    genericConnectError: "Não foi possível conectar. Tente novamente.",
    connectedAccounts: "Contas conectadas",
    connectAnotherInstagram: "Conectar outro Instagram",
    displayName: "Nome de visualização",
    addDisplayName: "Adicionar nome",
    editDisplayName: "Editar nome",
    displayNamePlaceholder: "Exemplo: João Instagram 1",
    displayNameHelp: "Use um nome fácil para identificar esta conta na hora de publicar.",
    save: "Salvar",
    cancel: "Cancelar",
    saving: "Salvando...",
    displayNameSaved: "Nome de visualização salvo.",
    displayNameSaveError: "Não foi possível salvar o nome de visualização.",
  },
  "es-ES": {
    title: "Plataformas",
    subtitle: "Conecta y gestiona todos los destinos desde un solo lugar.",
    refreshConnections: "Actualizar conexiones",
    total: "Total",
    connected: "Conectadas",
    ready: "Listas",
    comingSoon: "Próximamente",
    all: "Todas",
    readyToConnect: "Listas para conectar",
    searchPlatforms: "Buscar plataformas...",
    loadingPlatforms: "Cargando plataformas...",
    noPlatformsFound: "No se encontraron plataformas",
    changeFilterSearch: "Cambia el filtro o la búsqueda.",
    securityNote: "Las credenciales de conexión se almacenan de forma segura y solo se usan en integraciones del servidor.",
    connectedAccount: "Cuenta conectada",
    integrationPending: "Integración pendiente",
    connecting: "Conectando...",
    connect: "Conectar",
    available: "Disponible",
    soon: "Próximamente",
    loadError: "No se pudieron cargar las conexiones de las plataformas.",
    serverError: "No se pudo conectar con el servidor.",
    unavailableSuffix: "aún no está disponible para conexión.",
    facebookConnected: "Facebook conectado y verificado correctamente.",
    instagramConnected: "Instagram conectado y verificado correctamente.",
    fanvueConnected: "Fanvue conectado y verificado correctamente.",
    authCancelled: "La autorización fue cancelada o denegada.",
    secureVerificationFailed: "No se pudo verificar la conexión de forma segura. Inténtalo de nuevo.",
    missingCode: "La plataforma no devolvió un código de autorización.",
    creatorMissing: "No se pudo identificar al creador asociado con esta conexión.",
    creatorNotFound: "No se encontró al creador seleccionado.",
    workspaceMissing: "No se pudo identificar el espacio de trabajo asociado con esta conexión.",
    configurationIncomplete: "La configuración de la integración está incompleta.",
    noFacebookPages: "La autorización se completó, pero no se encontró ninguna Página de Facebook administrable.",
    tokenExchangeFailed: "La autorización se completó, pero falló el intercambio del token.",
    longTokenFailed: "La conexión se realizó, pero no se pudo generar el token de larga duración.",
    pagesFetchFailed: "La conexión se realizó, pero el sistema no pudo leer las Páginas de Facebook disponibles.",
    tokenEncryptionFailed: "La conexión se realizó, pero no se pudo guardar la credencial de forma segura.",
    missingAccessToken: "La plataforma no devolvió un token de acceso válido.",
    profileCheckFailed: "No se pudo verificar la cuenta después de la autorización.",
    invalidProfile: "La plataforma devolvió un perfil de cuenta no válido.",
    secureSessionExpired: "La sesión segura de conexión expiró. Inténtalo de nuevo.",
    internalError: "Se produjo un error interno al conectar la plataforma.",
    genericConnectError: "No se pudo conectar. Inténtalo de nuevo.",
    connectedAccounts: "Cuentas conectadas",
    connectAnotherInstagram: "Conectar otro Instagram",
    displayName: "Nombre para mostrar",
    addDisplayName: "Agregar nombre",
    editDisplayName: "Editar nombre",
    displayNamePlaceholder: "Ejemplo: João Instagram 1",
    displayNameHelp: "Usa un nombre fácil para identificar esta cuenta al publicar.",
    save: "Guardar",
    cancel: "Cancelar",
    saving: "Guardando...",
    displayNameSaved: "Nombre para mostrar guardado.",
    displayNameSaveError: "No se pudo guardar el nombre para mostrar.",
  },
  "fr-FR": {
    title: "Plateformes",
    subtitle: "Connectez et gérez toutes les destinations depuis un seul espace.",
    refreshConnections: "Actualiser les connexions",
    total: "Total",
    connected: "Connectées",
    ready: "Prêtes",
    comingSoon: "Bientôt",
    all: "Toutes",
    readyToConnect: "Prêtes à connecter",
    searchPlatforms: "Rechercher des plateformes...",
    loadingPlatforms: "Chargement des plateformes...",
    noPlatformsFound: "Aucune plateforme trouvée",
    changeFilterSearch: "Modifiez le filtre ou la recherche.",
    securityNote: "Les identifiants de connexion sont stockés de manière sécurisée et utilisés uniquement par les intégrations côté serveur.",
    connectedAccount: "Compte connecté",
    integrationPending: "Intégration en attente",
    connecting: "Connexion...",
    connect: "Connecter",
    available: "Disponible",
    soon: "Bientôt",
    loadError: "Impossible de charger les connexions aux plateformes.",
    serverError: "Impossible de se connecter au serveur.",
    unavailableSuffix: "n'est pas encore disponible pour la connexion.",
    facebookConnected: "Facebook connecté et vérifié avec succès.",
    instagramConnected: "Instagram connecté et vérifié avec succès.",
    fanvueConnected: "Fanvue connecté et vérifié avec succès.",
    authCancelled: "L'autorisation a été annulée ou refusée.",
    secureVerificationFailed: "La connexion n'a pas pu être vérifiée de manière sécurisée. Réessayez.",
    missingCode: "La plateforme n'a pas renvoyé de code d'autorisation.",
    creatorMissing: "Le créateur associé à cette connexion n'a pas pu être identifié.",
    creatorNotFound: "Le créateur sélectionné est introuvable.",
    workspaceMissing: "L'espace de travail associé à cette connexion n'a pas pu être identifié.",
    configurationIncomplete: "La configuration de l'intégration est incomplète.",
    noFacebookPages: "L'autorisation a réussi, mais aucune Page Facebook gérable n'a été trouvée.",
    tokenExchangeFailed: "L'autorisation a réussi, mais l'échange du jeton a échoué.",
    longTokenFailed: "La connexion a réussi, mais le jeton longue durée n'a pas pu être généré.",
    pagesFetchFailed: "La connexion a réussi, mais le système n'a pas pu lire les Pages Facebook disponibles.",
    tokenEncryptionFailed: "La connexion a réussi, mais l'identifiant sécurisé n'a pas pu être stocké.",
    missingAccessToken: "La plateforme n'a pas renvoyé de jeton d'accès valide.",
    profileCheckFailed: "Le compte n'a pas pu être vérifié après l'autorisation.",
    invalidProfile: "La plateforme a renvoyé un profil de compte invalide.",
    secureSessionExpired: "La session de connexion sécurisée a expiré. Réessayez.",
    internalError: "Une erreur interne s'est produite lors de la connexion à la plateforme.",
    genericConnectError: "Impossible de se connecter. Réessayez.",
    connectedAccounts: "Comptes connectés",
    connectAnotherInstagram: "Connecter un autre Instagram",
    displayName: "Nom d’affichage",
    addDisplayName: "Ajouter un nom",
    editDisplayName: "Modifier le nom",
    displayNamePlaceholder: "Exemple : João Instagram 1",
    displayNameHelp: "Utilisez un nom simple pour identifier ce compte lors de la publication.",
    save: "Enregistrer",
    cancel: "Annuler",
    saving: "Enregistrement...",
    displayNameSaved: "Nom d’affichage enregistré.",
    displayNameSaveError: "Impossible d’enregistrer le nom d’affichage.",
  },
  "cs-CZ": {
    title: "Platformy",
    subtitle: "Připojte a spravujte všechny cíle z jednoho místa.",
    refreshConnections: "Obnovit připojení",
    total: "Celkem",
    connected: "Připojeno",
    ready: "Připraveno",
    comingSoon: "Již brzy",
    all: "Vše",
    readyToConnect: "Připraveno k připojení",
    searchPlatforms: "Hledat platformy...",
    loadingPlatforms: "Načítání platforem...",
    noPlatformsFound: "Nebyly nalezeny žádné platformy",
    changeFilterSearch: "Změňte filtr nebo vyhledávání.",
    securityNote: "Přihlašovací údaje jsou bezpečně uloženy a používají se pouze serverovými integracemi.",
    connectedAccount: "Připojený účet",
    integrationPending: "Integrace čeká",
    connecting: "Připojování...",
    connect: "Připojit",
    available: "Dostupné",
    soon: "Již brzy",
    loadError: "Připojení platforem se nepodařilo načíst.",
    serverError: "K serveru se nepodařilo připojit.",
    unavailableSuffix: "zatím není dostupná pro připojení.",
    facebookConnected: "Facebook byl úspěšně připojen a ověřen.",
    instagramConnected: "Instagram byl úspěšně připojen a ověřen.",
    fanvueConnected: "Fanvue bylo úspěšně připojeno a ověřeno.",
    authCancelled: "Autorizace byla zrušena nebo zamítnuta.",
    secureVerificationFailed: "Připojení se nepodařilo bezpečně ověřit. Zkuste to znovu.",
    missingCode: "Platforma nevrátila autorizační kód.",
    creatorMissing: "Tvůrce spojeného s tímto připojením se nepodařilo identifikovat.",
    creatorNotFound: "Vybraný tvůrce nebyl nalezen.",
    workspaceMissing: "Workspace spojený s tímto připojením se nepodařilo identifikovat.",
    configurationIncomplete: "Konfigurace integrace není kompletní.",
    noFacebookPages: "Autorizace proběhla úspěšně, ale nebyla nalezena žádná spravovatelná Facebook stránka.",
    tokenExchangeFailed: "Autorizace proběhla, ale výměna tokenu selhala.",
    longTokenFailed: "Připojení proběhlo, ale nepodařilo se vytvořit dlouhodobý token.",
    pagesFetchFailed: "Připojení proběhlo, ale systém nemohl načíst dostupné Facebook stránky.",
    tokenEncryptionFailed: "Připojení proběhlo, ale bezpečné přihlašovací údaje se nepodařilo uložit.",
    missingAccessToken: "Platforma nevrátila platný přístupový token.",
    profileCheckFailed: "Účet se po autorizaci nepodařilo ověřit.",
    invalidProfile: "Platforma vrátila neplatný profil účtu.",
    secureSessionExpired: "Bezpečná relace připojení vypršela. Zkuste to znovu.",
    internalError: "Při připojování platformy došlo k interní chybě.",
    genericConnectError: "Připojení se nezdařilo. Zkuste to znovu.",
    connectedAccounts: "Připojené účty",
    connectAnotherInstagram: "Připojit další Instagram",
    displayName: "Zobrazované jméno",
    addDisplayName: "Přidat jméno",
    editDisplayName: "Upravit jméno",
    displayNamePlaceholder: "Příklad: João Instagram 1",
    displayNameHelp: "Použijte snadno rozpoznatelné jméno pro tento účet při publikování.",
    save: "Uložit",
    cancel: "Zrušit",
    saving: "Ukládání...",
    displayNameSaved: "Zobrazované jméno bylo uloženo.",
    displayNameSaveError: "Zobrazované jméno se nepodařilo uložit.",
  },
} as const;

type SupportedLocale = keyof typeof UI;

export default function PlatformsPage() {
  const params = useParams<{ locale: string }>();
  const locale =
    params.locale && params.locale in UI
      ? (params.locale as SupportedLocale)
      : "en-US";
  const ui = UI[locale];

  const searchParams =
    useSearchParams();

  const [
    platforms,
    setPlatforms,
  ] = useState<
    PlatformItem[]
  >([]);

  const [
    connectedCount,
    setConnectedCount,
  ] = useState(0);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isConnecting,
    setIsConnecting,
  ] = useState<
    string | null
  >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    editingAccountId,
    setEditingAccountId,
  ] = useState<string | null>(
    null,
  );

  const [
    displayNameDraft,
    setDisplayNameDraft,
  ] = useState("");

  const [
    savingDisplayNameId,
    setSavingDisplayNameId,
  ] = useState<string | null>(
    null,
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState<
    PlatformFilter
  >("ALL");

  const loadPlatforms =
    useCallback(
      async () => {
        try {
          setIsLoading(
            true,
          );

          setErrorMessage(
            "",
          );

          const response =
            await fetch(
              "/api/platforms",
              {
                method:
                  "GET",
                cache:
                  "no-store",
              },
            );

          const data =
            (await response.json()) as PlatformsResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            setErrorMessage(
              ui.loadError,
            );

            return;
          }

          setPlatforms(
            data.platforms,
          );

          setConnectedCount(
            data.connectedCount,
          );
        } catch (error) {
          console.error(
            "PLATFORMS_LOAD_ERROR",
            error,
          );

          setErrorMessage(
            ui.serverError,
          );
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [
        ui.loadError,
        ui.serverError,
      ],
    );

  useEffect(() => {
    const fanvueStatus =
      searchParams.get(
        "fanvue",
      );

    const instagramStatus =
      searchParams.get(
        "instagram",
      );

    const facebookStatus =
      searchParams.get(
        "facebook",
      );

    const reason =
      searchParams.get(
        "reason",
      );

    if (
      facebookStatus ===
      "connected"
    ) {
      setSuccessMessage(
        ui.facebookConnected,
      );

      setErrorMessage(
        "",
      );

      void loadPlatforms();

      return;
    }

    if (
      facebookStatus ===
      "error"
    ) {
      setSuccessMessage(
        "",
      );

      setErrorMessage(
        getFacebookErrorMessage(
          reason,
          ui,
        ),
      );

      return;
    }

    if (
      instagramStatus ===
      "connected"
    ) {
      setSuccessMessage(
        ui.instagramConnected,
      );

      setErrorMessage(
        "",
      );

      void loadPlatforms();

      return;
    }

    if (
      instagramStatus ===
      "error"
    ) {
      setSuccessMessage(
        "",
      );

      setErrorMessage(
        getInstagramErrorMessage(
          reason,
          ui,
        ),
      );

      return;
    }

    if (
      fanvueStatus ===
      "connected"
    ) {
      setSuccessMessage(
        ui.fanvueConnected,
      );

      setErrorMessage(
        "",
      );

      void loadPlatforms();

      return;
    }

    if (
      fanvueStatus ===
      "error"
    ) {
      setSuccessMessage(
        "",
      );

      setErrorMessage(
        getFanvueErrorMessage(
          reason,
          ui,
        ),
      );
    }
  }, [
    searchParams,
    loadPlatforms,
    ui,
  ]);

  useEffect(() => {
    void loadPlatforms();
  }, [
    loadPlatforms,
  ]);

  const displayedPlatforms =
    useMemo(() => {
      const backendMap =
        new Map(
          platforms.map(
            (platform) => [
              platform.code,
              platform,
            ],
          ),
        );

      return PLATFORM_DISPLAY_ORDER.map(
        (code) => {
          const backendPlatform =
            backendMap.get(
              code,
            );

          if (
            backendPlatform
          ) {
            return backendPlatform;
          }

          return (
            FALLBACK_PLATFORMS.find(
              (platform) =>
                platform.code ===
                code,
            )!
          );
        },
      );
    }, [
      platforms,
    ]);

  const filteredPlatforms =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return displayedPlatforms.filter(
        (platform) => {
          const connected =
            isPlatformConnected(
              platform,
            );

          const available =
            platform.availability ===
            "AVAILABLE";

          if (
            filter ===
              "CONNECTED" &&
            !connected
          ) {
            return false;
          }

          if (
            filter ===
              "AVAILABLE" &&
            (
              connected ||
              !available
            )
          ) {
            return false;
          }

          if (
            filter ===
              "COMING_SOON" &&
            (
              connected ||
              available
            )
          ) {
            return false;
          }

          if (
            query &&
            !platform.name
              .toLowerCase()
              .includes(
                query,
              )
          ) {
            return false;
          }

          return true;
        },
      );
    }, [
      displayedPlatforms,
      search,
      filter,
    ]);

  const availableCount =
    useMemo(
      () =>
        displayedPlatforms.filter(
          (platform) =>
            !isPlatformConnected(
              platform,
            ) &&
            platform.availability ===
              "AVAILABLE",
        ).length,
      [
        displayedPlatforms,
      ],
    );

  const comingSoonCount =
    displayedPlatforms.length -
    connectedCount -
    availableCount;

  function beginDisplayNameEdit(
    account: PlatformAccount,
  ) {
    setEditingAccountId(
      account.id,
    );

    const hasCustomName =
      Boolean(
        account.externalDisplayName &&
          account.externalDisplayName !==
            account.externalUsername,
      );

    setDisplayNameDraft(
      hasCustomName
        ? account.externalDisplayName ??
            ""
        : "",
    );

    setErrorMessage(
      "",
    );
  }

  function cancelDisplayNameEdit() {
    setEditingAccountId(
      null,
    );
    setDisplayNameDraft(
      "",
    );
  }

  async function saveDisplayName(
    accountId: string,
  ) {
    if (
      savingDisplayNameId ===
      accountId
    ) {
      return;
    }

    const displayName =
      displayNameDraft
        .trim()
        .slice(
          0,
          80,
        );

    if (!displayName) {
      setErrorMessage(
        ui.displayNameSaveError,
      );
      return;
    }

    type SaveDisplayNameResponse = {
      success?: boolean;
      error?: string;
      message?: string;
      account?: PlatformAccount;
    };

    const endpoint =
      `/api/platforms/accounts/${encodeURIComponent(
        accountId,
      )}/display-name`;

    const requestBody =
      JSON.stringify({
        displayName,
      });

    async function performSaveAttempt() {
      const controller =
        new AbortController();

      const timeoutId =
        window.setTimeout(
          () => {
            controller.abort();
          },
          12000,
        );

      try {
        const response =
          await fetch(
            endpoint,
            {
              method:
                "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                requestBody,
              signal:
                controller.signal,
            },
          );

        const contentType =
          response.headers.get(
            "content-type",
          ) ?? "";

        let data:
          | SaveDisplayNameResponse
          | null = null;

        if (
          contentType.includes(
            "application/json",
          )
        ) {
          try {
            data =
              (await response.json()) as SaveDisplayNameResponse;
          } catch {
            data = null;
          }
        } else {
          try {
            await response.text();
          } catch {
            // Ignore non-JSON server bodies.
          }
        }

        return {
          response,
          data,
        };
      } finally {
        window.clearTimeout(
          timeoutId,
        );
      }
    }

    try {
      setSavingDisplayNameId(
        accountId,
      );
      setErrorMessage(
        "",
      );
      setSuccessMessage(
        "",
      );

      let saved = false;
      let lastErrorMessage: string =
        ui.displayNameSaveError;

      for (
        let attempt = 0;
        attempt < 2;
        attempt += 1
      ) {
        try {
          const {
            response,
            data,
          } =
            await performSaveAttempt();

          if (
            response.ok &&
            data?.success
          ) {
            saved = true;
            break;
          }

          lastErrorMessage =
            data?.message ||
            data?.error ||
            ui.displayNameSaveError;

          const canRetry =
            attempt === 0 &&
            response.status >= 500;

          if (!canRetry) {
            break;
          }
        } catch (error) {
          console.warn(
            "PLATFORM_DISPLAY_NAME_SAVE_ATTEMPT_FAILED",
            {
              attempt:
                attempt + 1,
              error:
                error instanceof Error
                  ? error.name
                  : "UNKNOWN_ERROR",
            },
          );

          if (attempt > 0) {
            break;
          }
        }

        await new Promise(
          (resolve) => {
            window.setTimeout(
              resolve,
              700,
            );
          },
        );
      }

      if (!saved) {
        throw new Error(
          lastErrorMessage,
        );
      }

      setPlatforms(
        (currentPlatforms) =>
          currentPlatforms.map(
            (platform) => ({
              ...platform,
              accounts:
                platform.accounts.map(
                  (account) =>
                    account.id ===
                    accountId
                      ? {
                          ...account,
                          externalDisplayName:
                            displayName,
                        }
                      : account,
                ),
            }),
          ),
      );

      setEditingAccountId(
        null,
      );
      setDisplayNameDraft(
        "",
      );
      setSuccessMessage(
        ui.displayNameSaved,
      );
    } catch (error) {
      console.error(
        "PLATFORM_DISPLAY_NAME_SAVE_ERROR",
        error,
      );

      setErrorMessage(
        error instanceof Error &&
          error.message
        ? error.message
        : ui.displayNameSaveError,
      );
    } finally {
      setSavingDisplayNameId(
        null,
      );
    }
  }

  function connectPlatform(
    platform: PlatformItem,
  ) {
    if (
      isPlatformConnected(
        platform,
      ) &&
      platform.code !==
        "INSTAGRAM"
    ) {
      return;
    }

    if (
      platform.availability !==
      "AVAILABLE"
    ) {
      return;
    }

    setErrorMessage(
      "",
    );

    setSuccessMessage(
      "",
    );

    if (
      platform.code ===
      "FANVUE"
    ) {
      setIsConnecting(
        "FANVUE",
      );

      window.location.href =
        "/api/platforms/fanvue/connect";

      return;
    }

    if (
      platform.code ===
      "INSTAGRAM"
    ) {
      setIsConnecting(
        "INSTAGRAM",
      );

      window.location.href =
        `/api/platforms/instagram/connect?locale=${encodeURIComponent(
          locale,
        )}&returnTo=app-platforms`;

      return;
    }

    if (
      platform.code ===
      "FACEBOOK"
    ) {
      setIsConnecting(
        "FACEBOOK",
      );

      window.location.href =
        "/api/platforms/facebook/connect";

      return;
    }

    setErrorMessage(
      `${platform.name} ${ui.unavailableSuffix}`,
    );
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#080b12] text-white">
      <div className="mx-auto w-full max-w-[1540px] px-5 py-6 sm:px-7 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
              <Plug className="h-4 w-4 text-blue-300" />
            </div>

            <div>
              <h1 className="text-[28px] font-semibold tracking-[-0.04em]">
                {ui.title}
              </h1>

              <p className="mt-0.5 text-xs text-white/35">
                {ui.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadPlatforms()
            }
            disabled={
              isLoading ||
              Boolean(
                isConnecting,
              )
            }
            className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-[11px] text-white/45 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                isLoading
                  ? "animate-spin"
                  : ""
              }`}
            />

            {ui.refreshConnections}
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label={ui.total}
            value={
              displayedPlatforms.length
            }
            icon={
              <Globe2 className="h-4 w-4 text-blue-300" />
            }
          />

          <StatCard
            label={ui.connected}
            value={
              connectedCount
            }
            icon={
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            }
          />

          <StatCard
            label={ui.ready}
            value={
              availableCount
            }
            icon={
              <Plug className="h-4 w-4 text-violet-300" />
            }
          />

          <StatCard
            label={ui.comingSoon}
            value={
              Math.max(
                0,
                comingSoonCount,
              )
            }
            icon={
              <LockKeyhole className="h-4 w-4 text-white/35" />
            }
          />
        </div>

        {successMessage && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-xs text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

            <span>
              {
                successMessage
              }
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs text-red-300">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />

            <span>
              {
                errorMessage
              }
            </span>
          </div>
        )}

        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterButton
              active={
                filter ===
                "ALL"
              }
              label={ui.all}
              count={
                displayedPlatforms.length
              }
              onClick={() =>
                setFilter(
                  "ALL",
                )
              }
            />

            <FilterButton
              active={
                filter ===
                "CONNECTED"
              }
              label={ui.connected}
              count={
                connectedCount
              }
              onClick={() =>
                setFilter(
                  "CONNECTED",
                )
              }
              green
            />

            <FilterButton
              active={
                filter ===
                "AVAILABLE"
              }
              label={ui.readyToConnect}
              count={
                availableCount
              }
              onClick={() =>
                setFilter(
                  "AVAILABLE",
                )
              }
            />

            <FilterButton
              active={
                filter ===
                "COMING_SOON"
              }
              label={ui.comingSoon}
              count={
                Math.max(
                  0,
                  comingSoonCount,
                )
              }
              onClick={() =>
                setFilter(
                  "COMING_SOON",
                )
              }
            />
          </div>

          <div className="relative w-full xl:w-[260px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />

            <input
              value={
                search
              }
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target
                    .value,
                )
              }
              placeholder={ui.searchPlatforms}
              className="h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] pl-9 pr-3 text-[11px] text-white outline-none placeholder:text-white/20 focus:border-blue-500/30"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-400" />

              <div className="mt-3 text-xs text-white/30">
                {ui.loadingPlatforms}
              </div>
            </div>
          </div>
        ) : filteredPlatforms.length ===
          0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[18px] border border-dashed border-white/[0.08] bg-white/[0.015] px-6 text-center">
            <Globe2 className="h-7 w-7 text-white/15" />

            <div className="mt-3 text-sm font-medium text-white/55">
              {ui.noPlatformsFound}
            </div>

            <div className="mt-1 text-[11px] text-white/25">
              {ui.changeFilterSearch}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {filteredPlatforms.map(
              (platform) => (
                <PlatformCard
                  key={
                    platform.code
                  }
                  platform={
                    platform
                  }
                  isConnecting={
                    isConnecting ===
                    platform.code
                  }
                  onConnect={() =>
                    connectPlatform(
                      platform,
                    )
                  }
                  editingAccountId={
                    editingAccountId
                  }
                  displayNameDraft={
                    displayNameDraft
                  }
                  savingDisplayNameId={
                    savingDisplayNameId
                  }
                  onBeginDisplayNameEdit={
                    beginDisplayNameEdit
                  }
                  onDisplayNameDraftChange={
                    setDisplayNameDraft
                  }
                  onSaveDisplayName={
                    saveDisplayName
                  }
                  onCancelDisplayNameEdit={
                    cancelDisplayNameEdit
                  }
                  ui={ui}
                />
              ),
            )}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3 text-[10px] text-white/25">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400/60" />

          {ui.securityNote}
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-white/[0.07] bg-white/[0.018] px-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.035]">
        {icon}
      </div>

      <div>
        <div className="text-[9px] uppercase tracking-[0.1em] text-white/25">
          {label}
        </div>

        <div className="mt-0.5 text-lg font-semibold text-white/80">
          {value}
        </div>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  label,
  count,
  onClick,
  green = false,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  green?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-medium transition ${
        active
          ? "border-blue-500/35 bg-blue-500/[0.08] text-white"
          : "border-white/[0.07] bg-white/[0.02] text-white/35 hover:text-white"
      }`}
    >
      {green && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      )}

      {label}

      <span className="text-white/25">
        {count}
      </span>
    </button>
  );
}

function PlatformCard({
  platform,
  isConnecting,
  onConnect,
  editingAccountId,
  displayNameDraft,
  savingDisplayNameId,
  onBeginDisplayNameEdit,
  onDisplayNameDraftChange,
  onSaveDisplayName,
  onCancelDisplayNameEdit,
  ui,
}: {
  platform: PlatformItem;
  isConnecting: boolean;
  onConnect: () => void;
  editingAccountId: string | null;
  displayNameDraft: string;
  savingDisplayNameId: string | null;
  onBeginDisplayNameEdit: (
    account: PlatformAccount,
  ) => void;
  onDisplayNameDraftChange: (
    value: string,
  ) => void;
  onSaveDisplayName: (
    accountId: string,
  ) => Promise<void>;
  onCancelDisplayNameEdit: () => void;
  ui: (typeof UI)[SupportedLocale];
}) {
  const connectedAccounts =
    platform.accounts.filter(
      (account) =>
        account.status ===
        "CONNECTED",
    );

  const connectedAccount =
    connectedAccounts[0];

  const isConnected =
    connectedAccounts.length >
    0;

  const isAvailable =
    platform.availability ===
    "AVAILABLE";

  const isInstagram =
    platform.code ===
    "INSTAGRAM";

  const accountName =
    connectedAccount
      ?.externalDisplayName ||
    connectedAccount
      ?.externalUsername ||
    null;

  return (
    <article
      className={`group relative flex min-h-[150px] flex-col rounded-[14px] border p-3 transition ${
        isInstagram
          ? "sm:col-span-2"
          : ""
      } ${
        isConnected
          ? "border-emerald-500/20 bg-emerald-500/[0.035]"
          : "border-white/[0.07] bg-[#0c111a] hover:border-white/[0.12]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <PlatformIcon
          code={
            platform.code
          }
          connected={
            isConnected
          }
        />

        <StatusIndicator
          connected={
            isConnected
          }
          available={
            isAvailable
          }
          ui={ui}
        />
      </div>

      <div className="mt-3 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-[12px] font-semibold text-white/85">
            {
              platform.name
            }
          </h2>

          {platform.officialApi && (
            <span className="shrink-0 rounded-full border border-blue-500/15 bg-blue-500/[0.06] px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.08em] text-blue-300/75">
              API
            </span>
          )}

          {isInstagram &&
            isConnected && (
              <span className="ml-auto shrink-0 text-[8px] font-medium text-white/25">
                {
                  connectedAccounts.length
                }{" "}
                {
                  ui.connectedAccounts
                }
              </span>
            )}
        </div>

        {!isInstagram && (
          <div className="mt-1 truncate text-[9px] text-white/25">
            {isConnected
              ? accountName
                ? accountName.startsWith(
                    "@",
                  )
                  ? accountName
                  : `@${accountName}`
                : ui.connectedAccount
              : isAvailable
                ? ui.readyToConnect
                : ui.integrationPending}
          </div>
        )}

        {isInstagram &&
          !isConnected && (
            <div className="mt-1 truncate text-[9px] text-white/25">
              {isAvailable
                ? ui.readyToConnect
                : ui.integrationPending}
            </div>
          )}
      </div>

      {isInstagram &&
        isConnected && (
          <div className="mt-3 space-y-2">
            {connectedAccounts.map(
              (account) => {
                const customDisplayName =
                  account.externalDisplayName &&
                  account.externalDisplayName !==
                    account.externalUsername
                    ? account.externalDisplayName
                    : null;

                const username =
                  account.externalUsername
                    ? account.externalUsername.startsWith(
                        "@",
                      )
                      ? account.externalUsername
                      : `@${account.externalUsername}`
                    : null;

                const isEditing =
                  editingAccountId ===
                  account.id;

                const isSaving =
                  savingDisplayNameId ===
                  account.id;

                return (
                  <div
                    key={
                      account.id
                    }
                    className="rounded-xl border border-white/[0.07] bg-black/15 p-2.5"
                  >
                    {isEditing ? (
                      <div>
                        <div className="mb-1.5 text-[8px] font-medium uppercase tracking-[0.08em] text-white/25">
                          {
                            ui.displayName
                          }
                        </div>

                        <input
                          autoFocus
                          value={
                            displayNameDraft
                          }
                          maxLength={
                            80
                          }
                          onChange={(
                            event,
                          ) =>
                            onDisplayNameDraftChange(
                              event
                                .target
                                .value,
                            )
                          }
                          onKeyDown={(
                            event,
                          ) => {
                            if (
                              event.key ===
                              "Enter"
                            ) {
                              event.preventDefault();
                              void onSaveDisplayName(
                                account.id,
                              );
                            }

                            if (
                              event.key ===
                              "Escape"
                            ) {
                              onCancelDisplayNameEdit();
                            }
                          }}
                          placeholder={
                            ui.displayNamePlaceholder
                          }
                          className="h-9 w-full rounded-lg border border-white/[0.09] bg-[#090d14] px-3 text-[10px] text-white/80 outline-none placeholder:text-white/20 focus:border-blue-400/35"
                        />

                        <div className="mt-1.5 text-[8px] leading-4 text-white/25">
                          {
                            ui.displayNameHelp
                          }
                        </div>

                        <div className="mt-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={
                              onCancelDisplayNameEdit
                            }
                            disabled={
                              isSaving
                            }
                            className="flex h-7 items-center gap-1 rounded-md border border-white/[0.07] px-2 text-[9px] text-white/40 transition hover:text-white disabled:opacity-40"
                          >
                            <X className="h-3 w-3" />
                            {
                              ui.cancel
                            }
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void onSaveDisplayName(
                                account.id,
                              )
                            }
                            disabled={
                              isSaving ||
                              !displayNameDraft.trim()
                            }
                            className="flex h-7 items-center gap-1 rounded-md border border-blue-400/20 bg-blue-500/[0.10] px-2.5 text-[9px] font-semibold text-blue-200 transition hover:bg-blue-500/[0.16] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}

                            {isSaving
                              ? ui.saving
                              : ui.save}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-semibold text-white/75">
                            {customDisplayName ||
                              username ||
                              ui.connectedAccount}
                          </div>

                          {customDisplayName &&
                            username && (
                              <div className="mt-0.5 truncate text-[8px] text-white/25">
                                {
                                  username
                                }
                              </div>
                            )}

                          {!customDisplayName &&
                            username && (
                              <div className="mt-0.5 text-[8px] text-amber-200/55">
                                {
                                  ui.displayNameHelp
                                }
                              </div>
                            )}
                        </div>

                        <div className="shrink-0 rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-2 py-1 text-[7px] font-medium text-emerald-300">
                          {
                            ui.connected
                          }
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            onBeginDisplayNameEdit(
                              account,
                            )
                          }
                          className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.025] px-2 text-[8px] text-white/40 transition hover:bg-white/[0.05] hover:text-white/70"
                          title={
                            customDisplayName
                              ? ui.editDisplayName
                              : ui.addDisplayName
                          }
                        >
                          <Pencil className="h-3 w-3" />
                          {customDisplayName
                            ? ui.editDisplayName
                            : ui.addDisplayName}
                        </button>
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}

      <div className="mt-auto pt-3">
        <button
          type="button"
          onClick={
            onConnect
          }
          disabled={
            !isAvailable ||
            (
              isConnected &&
              !isInstagram
            ) ||
            isConnecting
          }
          className={`flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border text-[10px] font-semibold transition ${
            isConnected &&
            !isInstagram
              ? "border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-300"
              : isAvailable
                ? "border-white/[0.09] bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                : "border-white/[0.05] bg-white/[0.015] text-white/20"
          } disabled:cursor-not-allowed`}
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              {ui.connecting}
            </>
          ) : isInstagram &&
            isConnected ? (
            <>
              <Plus className="h-3 w-3" />
              {
                ui.connectAnotherInstagram
              }
            </>
          ) : isConnected ? (
            <>
              <Check className="h-3 w-3" />
              {ui.connected}
            </>
          ) : isAvailable ? (
            <>
              {ui.connect}
              <ExternalLink className="h-3 w-3" />
            </>
          ) : (
            <>
              <LockKeyhole className="h-3 w-3" />
              {ui.comingSoon}
            </>
          )}
        </button>
      </div>
    </article>
  );
}

function PlatformIcon({
  code,
  connected,
}: {
  code: string;
  connected: boolean;
}) {
  const icon =
    getSimpleIcon(
      code,
    );

  if (icon) {
    const brandColor =
      `#${icon.hex}`;

    const needsLightBackground =
      shouldUseLightBadgeBackground(
        icon.hex,
      );

    return (
      <div
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border ${
          connected
            ? "border-emerald-500/20 bg-emerald-500/[0.06]"
            : "border-white/[0.07] bg-white/[0.025]"
        }`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-20 blur-lg"
          style={{
            backgroundColor:
              brandColor,
          }}
        />

        <div
          className={`relative flex h-7 w-7 items-center justify-center rounded-md ${
            needsLightBackground
              ? "bg-white"
              : ""
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            role="img"
            aria-label={
              icon.title
            }
            className="h-4.5 w-4.5"
            style={{
              fill:
                brandColor,
            }}
          >
            <path
              d={
                icon.path
              }
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold ${
        connected
          ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300"
          : "border-white/[0.07] bg-white/[0.025] text-white/60"
      }`}
    >
      {getPlatformMonogram(
        code,
      )}
    </div>
  );
}

function StatusIndicator({
  connected,
  available,
  ui,
}: {
  connected: boolean;
  available: boolean;
  ui: (typeof UI)[SupportedLocale];
}) {
  if (connected) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-2 py-1 text-[8px] font-medium text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

        {ui.connected}
      </div>
    );
  }

  if (available) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-blue-500/15 bg-blue-500/[0.06] px-2 py-1 text-[8px] font-medium text-blue-300">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />

        {ui.available}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[8px] font-medium text-white/25">
      <span className="h-1.5 w-1.5 rounded-full bg-white/20" />

      {ui.soon}
    </div>
  );
}

function isPlatformConnected(
  platform: PlatformItem,
) {
  return (
    platform.connected ||
    platform.accounts.some(
      (account) =>
        account.status ===
        "CONNECTED",
    )
  );
}

function getSimpleIcon(
  code: string,
): SimpleIcon | null {
  const icons =
    SimpleIcons as unknown as Record<
      string,
      SimpleIcon
    >;

  const keys:
    Record<
      string,
      string[]
    > = {
      INSTAGRAM: [
        "siInstagram",
      ],

      FACEBOOK: [
        "siFacebook",
      ],

      X: [
        "siX",
      ],

      REDDIT: [
        "siReddit",
      ],

      PORNHUB: [
        "siPornhub",
        "siPornHub",
      ],

      ONLYFANS: [
        "siOnlyfans",
        "siOnlyFans",
      ],

      FANSLY: [
        "siFansly",
      ],

      FANVUE: [
        "siFanvue",
      ],

      MANYVIDS: [
        "siManyvids",
        "siManyVids",
      ],

      MYM: [
        "siMym",
        "siMYM",
      ],

      LOYALFANS: [
        "siLoyalfans",
        "siLoyalFans",
      ],
    };

  const candidates =
    keys[code] ?? [];

  for (
    const key of candidates
  ) {
    const icon =
      icons[key];

    if (
      icon &&
      typeof icon.path ===
        "string"
    ) {
      return icon;
    }
  }

  return null;
}

function shouldUseLightBadgeBackground(
  hex: string,
) {
  const normalized =
    hex
      .replace(
        "#",
        "",
      )
      .toUpperCase();

  if (
    normalized.length !==
    6
  ) {
    return false;
  }

  const red =
    parseInt(
      normalized.slice(
        0,
        2,
      ),
      16,
    );

  const green =
    parseInt(
      normalized.slice(
        2,
        4,
      ),
      16,
    );

  const blue =
    parseInt(
      normalized.slice(
        4,
        6,
      ),
      16,
    );

  const luminance =
    0.2126 * red +
    0.7152 * green +
    0.0722 * blue;

  return (
    luminance <
    70
  );
}

function getPlatformMonogram(
  code: string,
) {
  switch (code) {
    case "FANVUE":
      return "FV";

    case "ONLYFANS":
      return "OF";

    case "FANSLY":
      return "FS";

    case "MYM":
      return "MYM";

    case "LOYALFANS":
      return "LF";

    case "INSTAGRAM":
      return "IG";

    case "FACEBOOK":
      return "f";

    case "X":
      return "X";

    case "REDDIT":
      return "R";

    case "MANYVIDS":
      return "MV";

    case "PORNHUB":
      return "PH";

    default:
      return code.slice(
        0,
        2,
      );
  }
}

function getFacebookErrorMessage(
  reason: string | null,
  ui: (typeof UI)[SupportedLocale],
) {
  switch (reason) {
    case "denied":
      return ui.authCancelled;
    case "state":
      return ui.secureVerificationFailed;
    case "code":
      return ui.missingCode;
    case "creator":
      return ui.creatorMissing;
    case "workspace":
      return ui.workspaceMissing;
    case "config":
      return ui.configurationIncomplete;
    case "no_pages":
      return ui.noFacebookPages;
    case "token_exchange":
      return ui.tokenExchangeFailed;
    case "long_token_exchange":
      return ui.longTokenFailed;
    case "pages_fetch":
      return ui.pagesFetchFailed;
    case "token_encryption":
      return ui.tokenEncryptionFailed;
    case "server":
      return ui.internalError;
    default:
      return ui.genericConnectError;
  }
}

function getInstagramErrorMessage(
  reason: string | null,
  ui: (typeof UI)[SupportedLocale],
) {
  switch (reason) {
    case "authorization_denied":
      return ui.authCancelled;
    case "invalid_state":
      return ui.secureVerificationFailed;
    case "missing_code":
      return ui.missingCode;
    case "missing_creator":
      return ui.creatorMissing;
    case "creator_not_found":
      return ui.creatorNotFound;
    case "configuration":
      return ui.configurationIncomplete;
    case "token_exchange":
      return ui.tokenExchangeFailed;
    case "missing_access_token":
      return ui.missingAccessToken;
    case "long_token_exchange":
    case "invalid_long_token":
      return ui.longTokenFailed;
    case "profile_check":
      return ui.profileCheckFailed;
    case "invalid_profile":
      return ui.invalidProfile;
    case "internal":
      return ui.internalError;
    default:
      return ui.genericConnectError;
  }
}

function getFanvueErrorMessage(
  reason: string | null,
  ui: (typeof UI)[SupportedLocale],
) {
  switch (reason) {
    case "authorization_denied":
      return ui.authCancelled;
    case "invalid_state":
      return ui.secureVerificationFailed;
    case "missing_code":
      return ui.missingCode;
    case "missing_verifier":
      return ui.secureSessionExpired;
    case "missing_creator":
      return ui.creatorMissing;
    case "creator_not_found":
      return ui.creatorNotFound;
    case "configuration":
      return ui.configurationIncomplete;
    case "token_exchange":
      return ui.tokenExchangeFailed;
    case "missing_access_token":
      return ui.missingAccessToken;
    case "profile_check":
      return ui.profileCheckFailed;
    case "invalid_profile":
      return ui.invalidProfile;
    case "internal":
      return ui.internalError;
    default:
      return ui.genericConnectError;
  }
}
