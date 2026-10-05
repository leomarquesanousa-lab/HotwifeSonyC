"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useLocale } from "next-intl";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Globe2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  useRouter,
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

type SupportedLocale =
  | "en-US"
  | "pt-BR"
  | "es-ES"
  | "fr-FR";

type UIStrings = {
  back: string;
  step: string;
  network: string;
  title: string;
  subtitle: string;
  connected: string;
  loading: string;
  refresh: string;
  continue: string;
  requirement: string;
  officialApi: string;
  verified: string;
  status: string;
  readyToConnect: string;
  integrationPending: string;
  connecting: string;
  connect: string;
  comingSoon: string;
  loadError: string;
  serverError: string;
  unavailable: string;
  minimumConnection: string;
  facebookConnected: string;
  instagramVerifying: string;
  instagramConnected: string;
  instagramNotVisible: string;
  fanvueConnected: string;
  platformDescriptions: Record<string, string>;
  errors: {
    facebook: Record<string, string>;
    instagram: Record<string, string>;
    fanvue: Record<string, string>;
  };
};

const UI: Record<SupportedLocale, UIStrings> = {
  "en-US": {
    back: "Back",
    step: "Step 4 of 5",
    network: "Distribution network",
    title: "Connect your platforms",
    subtitle:
      "Build your distribution network. Connect at least one verified account to continue.",
    connected: "Connected",
    loading: "Loading platforms...",
    refresh: "Refresh connections",
    continue: "Continue",
    requirement: "One verified connection is required to continue.",
    officialApi: "Official API",
    verified: "Verified",
    status: "Status",
    readyToConnect: "Ready to connect",
    integrationPending: "Integration pending",
    connecting: "Connecting...",
    connect: "Connect",
    comingSoon: "Coming soon",
    loadError: "Unable to load platform connections.",
    serverError: "Unable to connect to the server.",
    unavailable: "connection is not available yet.",
    minimumConnection:
      "Connect and verify at least one platform before continuing.",
    facebookConnected:
      "Facebook connected and verified successfully.",
    instagramVerifying:
      "Instagram authorization completed. Verifying connection...",
    instagramConnected:
      "Instagram connected and verified successfully.",
    instagramNotVisible:
      "Instagram authorization completed, but the connected account is not visible yet. Use Refresh connections once. If it remains disconnected, the /api/platforms response needs to be checked.",
    fanvueConnected:
      "Fanvue connected and verified successfully.",
    platformDescriptions: {
      FANVUE:
        "Connect your Fanvue creator account and authorize publishing access.",
      ONLYFANS:
        "Manage and distribute creator content from one central workspace.",
      FANSLY:
        "Centralize creator publishing and content distribution workflows.",
      MYM:
        "Prepare creator content for streamlined publishing and management.",
      LOYALFANS:
        "Expand your connected publishing options.",
      INSTAGRAM:
        "Connect a professional Instagram account using the official Instagram Business Login.",
      FACEBOOK:
        "Connect Facebook Pages for centralized publishing and management.",
      MANYVIDS:
        "Connect and distribute creator content to ManyVids through the managed browser connection.",
      X:
        "Connect an X account for publishing and content distribution.",
      REDDIT:
        "Connect Reddit for publishing into authorized communities.",
    },
    errors: {
      facebook: {
        denied: "Facebook authorization was cancelled or denied.",
        state: "The Facebook connection could not be verified securely. Please try again.",
        code: "Facebook did not return an authorization code.",
        creator: "The creator associated with this Facebook connection could not be identified.",
        workspace: "The workspace associated with this Facebook connection could not be identified.",
        config: "Facebook is not configured correctly on this server. Please contact support.",
        no_pages: "Facebook authorization succeeded, but no manageable Facebook Page was found. Connect a Facebook account with full access to at least one Page.",
        token_exchange: "Facebook authorized the account, but the access token could not be generated. Please try again.",
        long_token_exchange: "Facebook connected, but the long-lived access token could not be generated. Please try again.",
        pages_fetch: "Facebook connected, but the system could not read the Pages available to this account. Check Page permissions and try again.",
        token_encryption: "Facebook connected, but the secure credential could not be stored. Please contact support.",
        server: "An unexpected error occurred while connecting Facebook. Please try again or contact support.",
        default: "Unable to connect Facebook. Please try again.",
      },
      instagram: {
        authorization_denied: "Instagram authorization was cancelled or denied.",
        invalid_state: "The Instagram connection could not be verified securely. Please try again.",
        missing_code: "Instagram did not return an authorization code.",
        missing_creator: "The creator associated with this Instagram connection could not be identified.",
        creator_not_found: "The selected creator could not be found.",
        configuration: "Instagram integration configuration is incomplete.",
        token_exchange: "Instagram authorization succeeded, but the token exchange failed.",
        missing_access_token: "Instagram did not return a valid access token.",
        long_token_exchange: "Instagram connected, but the long-lived access token could not be generated.",
        invalid_long_token: "Instagram returned an invalid long-lived access token.",
        profile_check: "The Instagram account could not be verified after authorization.",
        invalid_profile: "Instagram returned an invalid professional account profile.",
        internal: "An internal error occurred while connecting Instagram.",
        default: "Unable to connect Instagram. Please try again.",
      },
      fanvue: {
        authorization_denied: "Fanvue authorization was cancelled or denied.",
        invalid_state: "The Fanvue connection could not be verified securely. Please try again.",
        missing_code: "Fanvue did not return an authorization code.",
        missing_verifier: "The Fanvue secure connection session expired. Please try again.",
        missing_creator: "The creator associated with this connection could not be identified.",
        creator_not_found: "The selected creator could not be found.",
        configuration: "Fanvue integration configuration is incomplete.",
        token_exchange: "Fanvue authorization succeeded, but the token exchange failed.",
        missing_access_token: "Fanvue did not return a valid access token.",
        profile_check: "The Fanvue account could not be verified after authorization.",
        invalid_profile: "Fanvue returned an invalid creator profile.",
        internal: "An internal error occurred while connecting Fanvue.",
        default: "Unable to connect Fanvue. Please try again.",
      },
    },
  },

  "pt-BR": {
    back: "Voltar",
    step: "Etapa 4 de 5",
    network: "Rede de distribuiÃ§Ã£o",
    title: "Conecte suas plataformas",
    subtitle:
      "Monte sua rede de distribuiÃ§Ã£o. Conecte pelo menos uma conta verificada para continuar.",
    connected: "Conectadas",
    loading: "Carregando plataformas...",
    refresh: "Atualizar conexÃµes",
    continue: "Continuar",
    requirement: "Ã‰ necessÃ¡rio ter pelo menos uma conexÃ£o verificada para continuar.",
    officialApi: "API oficial",
    verified: "Verificada",
    status: "Status",
    readyToConnect: "Pronta para conectar",
    integrationPending: "IntegraÃ§Ã£o pendente",
    connecting: "Conectando...",
    connect: "Conectar",
    comingSoon: "Em breve",
    loadError: "NÃ£o foi possÃ­vel carregar as conexÃµes das plataformas.",
    serverError: "NÃ£o foi possÃ­vel conectar ao servidor.",
    unavailable: "a conexÃ£o ainda nÃ£o estÃ¡ disponÃ­vel.",
    minimumConnection:
      "Conecte e verifique pelo menos uma plataforma antes de continuar.",
    facebookConnected:
      "Facebook conectado e verificado com sucesso.",
    instagramVerifying:
      "AutorizaÃ§Ã£o do Instagram concluÃ­da. Verificando a conexÃ£o...",
    instagramConnected:
      "Instagram conectado e verificado com sucesso.",
    instagramNotVisible:
      "A autorizaÃ§Ã£o do Instagram foi concluÃ­da, mas a conta conectada ainda nÃ£o apareceu. Use Atualizar conexÃµes uma vez. Se continuar desconectada, serÃ¡ necessÃ¡rio verificar a resposta de /api/platforms.",
    fanvueConnected:
      "Fanvue conectado e verificado com sucesso.",
    platformDescriptions: {
      FANVUE:
        "Conecte sua conta de criador do Fanvue e autorize o acesso para publicaÃ§Ã£o.",
      ONLYFANS:
        "Gerencie e distribua conteÃºdo de criadores a partir de um Ãºnico ambiente.",
      FANSLY:
        "Centralize os fluxos de publicaÃ§Ã£o e distribuiÃ§Ã£o de conteÃºdo dos criadores.",
      MYM:
        "Prepare conteÃºdo de criadores para publicaÃ§Ã£o e gerenciamento simplificados.",
      LOYALFANS:
        "Amplie seu fluxo de distribuiÃ§Ã£o para outra plataforma de criadores.",
      INSTAGRAM:
        "Conecte uma conta profissional do Instagram usando o login oficial do Instagram Business.",
      FACEBOOK:
        "Conecte PÃ¡ginas do Facebook para publicaÃ§Ã£o e gerenciamento centralizados.",
      MANYVIDS:
        "Conecte e distribua conteÃºdo de criadores no ManyVids usando a conexÃ£o gerenciada pelo navegador.",
      X:
        "Conecte uma conta do X para publicaÃ§Ã£o e distribuiÃ§Ã£o de conteÃºdo.",
      REDDIT:
        "Conecte o Reddit para publicar em comunidades autorizadas.",
    },
    errors: {
      facebook: {
        denied: "A autorizaÃ§Ã£o do Facebook foi cancelada ou negada.",
        state: "NÃ£o foi possÃ­vel verificar a conexÃ£o do Facebook com seguranÃ§a. Tente novamente.",
        code: "O Facebook nÃ£o retornou um cÃ³digo de autorizaÃ§Ã£o.",
        creator: "NÃ£o foi possÃ­vel identificar o criador associado a esta conexÃ£o do Facebook.",
        workspace: "NÃ£o foi possÃ­vel identificar o workspace associado a esta conexÃ£o do Facebook.",
        config: "O Facebook nÃ£o estÃ¡ configurado corretamente neste servidor. Entre em contato com o suporte.",
        no_pages: "A autorizaÃ§Ã£o do Facebook foi concluÃ­da, mas nenhuma PÃ¡gina gerenciÃ¡vel foi encontrada. Conecte uma conta do Facebook com acesso total a pelo menos uma PÃ¡gina.",
        token_exchange: "O Facebook autorizou a conta, mas nÃ£o foi possÃ­vel gerar o token de acesso. Tente novamente.",
        long_token_exchange: "O Facebook foi conectado, mas nÃ£o foi possÃ­vel gerar o token de longa duraÃ§Ã£o. Tente novamente.",
        pages_fetch: "O Facebook foi conectado, mas o sistema nÃ£o conseguiu ler as PÃ¡ginas disponÃ­veis. Verifique as permissÃµes da PÃ¡gina e tente novamente.",
        token_encryption: "O Facebook foi conectado, mas nÃ£o foi possÃ­vel armazenar a credencial com seguranÃ§a. Entre em contato com o suporte.",
        server: "Ocorreu um erro inesperado ao conectar o Facebook. Tente novamente ou entre em contato com o suporte.",
        default: "NÃ£o foi possÃ­vel conectar o Facebook. Tente novamente.",
      },
      instagram: {
        authorization_denied: "A autorizaÃ§Ã£o do Instagram foi cancelada ou negada.",
        invalid_state: "NÃ£o foi possÃ­vel verificar a conexÃ£o do Instagram com seguranÃ§a. Tente novamente.",
        missing_code: "O Instagram nÃ£o retornou um cÃ³digo de autorizaÃ§Ã£o.",
        missing_creator: "NÃ£o foi possÃ­vel identificar o criador associado a esta conexÃ£o do Instagram.",
        creator_not_found: "O criador selecionado nÃ£o foi encontrado.",
        configuration: "A configuraÃ§Ã£o da integraÃ§Ã£o com o Instagram estÃ¡ incompleta.",
        token_exchange: "A autorizaÃ§Ã£o do Instagram foi concluÃ­da, mas a troca do token falhou.",
        missing_access_token: "O Instagram nÃ£o retornou um token de acesso vÃ¡lido.",
        long_token_exchange: "O Instagram foi conectado, mas nÃ£o foi possÃ­vel gerar o token de longa duraÃ§Ã£o.",
        invalid_long_token: "O Instagram retornou um token de longa duraÃ§Ã£o invÃ¡lido.",
        profile_check: "NÃ£o foi possÃ­vel verificar a conta do Instagram apÃ³s a autorizaÃ§Ã£o.",
        invalid_profile: "O Instagram retornou um perfil profissional invÃ¡lido.",
        internal: "Ocorreu um erro interno ao conectar o Instagram.",
        default: "NÃ£o foi possÃ­vel conectar o Instagram. Tente novamente.",
      },
      fanvue: {
        authorization_denied: "A autorizaÃ§Ã£o do Fanvue foi cancelada ou negada.",
        invalid_state: "NÃ£o foi possÃ­vel verificar a conexÃ£o do Fanvue com seguranÃ§a. Tente novamente.",
        missing_code: "O Fanvue nÃ£o retornou um cÃ³digo de autorizaÃ§Ã£o.",
        missing_verifier: "A sessÃ£o segura de conexÃ£o do Fanvue expirou. Tente novamente.",
        missing_creator: "NÃ£o foi possÃ­vel identificar o criador associado a esta conexÃ£o.",
        creator_not_found: "O criador selecionado nÃ£o foi encontrado.",
        configuration: "A configuraÃ§Ã£o da integraÃ§Ã£o com o Fanvue estÃ¡ incompleta.",
        token_exchange: "A autorizaÃ§Ã£o do Fanvue foi concluÃ­da, mas a troca do token falhou.",
        missing_access_token: "O Fanvue nÃ£o retornou um token de acesso vÃ¡lido.",
        profile_check: "NÃ£o foi possÃ­vel verificar a conta do Fanvue apÃ³s a autorizaÃ§Ã£o.",
        invalid_profile: "O Fanvue retornou um perfil de criador invÃ¡lido.",
        internal: "Ocorreu um erro interno ao conectar o Fanvue.",
        default: "NÃ£o foi possÃ­vel conectar o Fanvue. Tente novamente.",
      },
    },
  },

  "es-ES": {
    back: "Volver",
    step: "Paso 4 de 5",
    network: "Red de distribuciÃ³n",
    title: "Conecta tus plataformas",
    subtitle:
      "Crea tu red de distribuciÃ³n. Conecta al menos una cuenta verificada para continuar.",
    connected: "Conectadas",
    loading: "Cargando plataformas...",
    refresh: "Actualizar conexiones",
    continue: "Continuar",
    requirement: "Se requiere al menos una conexiÃ³n verificada para continuar.",
    officialApi: "API oficial",
    verified: "Verificada",
    status: "Estado",
    readyToConnect: "Lista para conectar",
    integrationPending: "IntegraciÃ³n pendiente",
    connecting: "Conectando...",
    connect: "Conectar",
    comingSoon: "PrÃ³ximamente",
    loadError: "No se pudieron cargar las conexiones de las plataformas.",
    serverError: "No se pudo conectar con el servidor.",
    unavailable: "la conexiÃ³n aÃºn no estÃ¡ disponible.",
    minimumConnection:
      "Conecta y verifica al menos una plataforma antes de continuar.",
    facebookConnected:
      "Facebook conectado y verificado correctamente.",
    instagramVerifying:
      "AutorizaciÃ³n de Instagram completada. Verificando la conexiÃ³n...",
    instagramConnected:
      "Instagram conectado y verificado correctamente.",
    instagramNotVisible:
      "La autorizaciÃ³n de Instagram se completÃ³, pero la cuenta conectada todavÃ­a no aparece. Usa Actualizar conexiones una vez. Si sigue desconectada, serÃ¡ necesario revisar la respuesta de /api/platforms.",
    fanvueConnected:
      "Fanvue conectado y verificado correctamente.",
    platformDescriptions: {
      FANVUE:
        "Conecta tu cuenta de creador de Fanvue y autoriza el acceso para publicar.",
      ONLYFANS:
        "Gestiona y distribuye contenido de creadores desde un Ãºnico espacio de trabajo.",
      FANSLY:
        "Centraliza los flujos de publicaciÃ³n y distribuciÃ³n de contenido de creadores.",
      MYM:
        "Prepara contenido de creadores para una publicaciÃ³n y gestiÃ³n mÃ¡s sencillas.",
      LOYALFANS:
        "AmplÃ­a tu flujo de distribuciÃ³n a otra plataforma para creadores.",
      INSTAGRAM:
        "Conecta una cuenta profesional de Instagram usando el inicio de sesiÃ³n oficial de Instagram Business.",
      FACEBOOK:
        "Conecta pÃ¡ginas de Facebook para publicaciÃ³n y gestiÃ³n centralizadas.",
      MANYVIDS:
        "Conecta y distribuye contenido de creadores en ManyVids mediante la conexiÃ³n administrada por el navegador.",
      X:
        "Conecta una cuenta de X para publicaciÃ³n y distribuciÃ³n de contenido.",
      REDDIT:
        "Conecta Reddit para publicar en comunidades autorizadas.",
    },
    errors: {
      facebook: {
        denied: "La autorizaciÃ³n de Facebook fue cancelada o rechazada.",
        state: "No se pudo verificar de forma segura la conexiÃ³n de Facebook. IntÃ©ntalo de nuevo.",
        code: "Facebook no devolviÃ³ un cÃ³digo de autorizaciÃ³n.",
        creator: "No se pudo identificar al creador asociado con esta conexiÃ³n de Facebook.",
        workspace: "No se pudo identificar el espacio de trabajo asociado con esta conexiÃ³n de Facebook.",
        config: "Facebook no estÃ¡ configurado correctamente en este servidor. Contacta con soporte.",
        no_pages: "La autorizaciÃ³n de Facebook se completÃ³, pero no se encontrÃ³ ninguna pÃ¡gina administrable. Conecta una cuenta de Facebook con acceso total a al menos una pÃ¡gina.",
        token_exchange: "Facebook autorizÃ³ la cuenta, pero no se pudo generar el token de acceso. IntÃ©ntalo de nuevo.",
        long_token_exchange: "Facebook se conectÃ³, pero no se pudo generar el token de larga duraciÃ³n. IntÃ©ntalo de nuevo.",
        pages_fetch: "Facebook se conectÃ³, pero el sistema no pudo leer las pÃ¡ginas disponibles. Revisa los permisos de la pÃ¡gina e intÃ©ntalo de nuevo.",
        token_encryption: "Facebook se conectÃ³, pero no se pudo guardar la credencial de forma segura. Contacta con soporte.",
        server: "OcurriÃ³ un error inesperado al conectar Facebook. IntÃ©ntalo de nuevo o contacta con soporte.",
        default: "No se pudo conectar Facebook. IntÃ©ntalo de nuevo.",
      },
      instagram: {
        authorization_denied: "La autorizaciÃ³n de Instagram fue cancelada o rechazada.",
        invalid_state: "No se pudo verificar de forma segura la conexiÃ³n de Instagram. IntÃ©ntalo de nuevo.",
        missing_code: "Instagram no devolviÃ³ un cÃ³digo de autorizaciÃ³n.",
        missing_creator: "No se pudo identificar al creador asociado con esta conexiÃ³n de Instagram.",
        creator_not_found: "No se encontrÃ³ el creador seleccionado.",
        configuration: "La configuraciÃ³n de la integraciÃ³n con Instagram estÃ¡ incompleta.",
        token_exchange: "La autorizaciÃ³n de Instagram se completÃ³, pero fallÃ³ el intercambio del token.",
        missing_access_token: "Instagram no devolviÃ³ un token de acceso vÃ¡lido.",
        long_token_exchange: "Instagram se conectÃ³, pero no se pudo generar el token de larga duraciÃ³n.",
        invalid_long_token: "Instagram devolviÃ³ un token de larga duraciÃ³n no vÃ¡lido.",
        profile_check: "No se pudo verificar la cuenta de Instagram despuÃ©s de la autorizaciÃ³n.",
        invalid_profile: "Instagram devolviÃ³ un perfil profesional no vÃ¡lido.",
        internal: "OcurriÃ³ un error interno al conectar Instagram.",
        default: "No se pudo conectar Instagram. IntÃ©ntalo de nuevo.",
      },
      fanvue: {
        authorization_denied: "La autorizaciÃ³n de Fanvue fue cancelada o rechazada.",
        invalid_state: "No se pudo verificar de forma segura la conexiÃ³n de Fanvue. IntÃ©ntalo de nuevo.",
        missing_code: "Fanvue no devolviÃ³ un cÃ³digo de autorizaciÃ³n.",
        missing_verifier: "La sesiÃ³n segura de conexiÃ³n de Fanvue expirÃ³. IntÃ©ntalo de nuevo.",
        missing_creator: "No se pudo identificar al creador asociado con esta conexiÃ³n.",
        creator_not_found: "No se encontrÃ³ el creador seleccionado.",
        configuration: "La configuraciÃ³n de la integraciÃ³n con Fanvue estÃ¡ incompleta.",
        token_exchange: "La autorizaciÃ³n de Fanvue se completÃ³, pero fallÃ³ el intercambio del token.",
        missing_access_token: "Fanvue no devolviÃ³ un token de acceso vÃ¡lido.",
        profile_check: "No se pudo verificar la cuenta de Fanvue despuÃ©s de la autorizaciÃ³n.",
        invalid_profile: "Fanvue devolviÃ³ un perfil de creador no vÃ¡lido.",
        internal: "OcurriÃ³ un error interno al conectar Fanvue.",
        default: "No se pudo conectar Fanvue. IntÃ©ntalo de nuevo.",
      },
    },
  },

  "fr-FR": {
    back: "Retour",
    step: "Ã‰tape 4 sur 5",
    network: "RÃ©seau de distribution",
    title: "Connectez vos plateformes",
    subtitle:
      "Construisez votre rÃ©seau de distribution. Connectez au moins un compte vÃ©rifiÃ© pour continuer.",
    connected: "ConnectÃ©es",
    loading: "Chargement des plateformes...",
    refresh: "Actualiser les connexions",
    continue: "Continuer",
    requirement: "Au moins une connexion vÃ©rifiÃ©e est requise pour continuer.",
    officialApi: "API officielle",
    verified: "VÃ©rifiÃ©e",
    status: "Statut",
    readyToConnect: "PrÃªte Ã  Ãªtre connectÃ©e",
    integrationPending: "IntÃ©gration en attente",
    connecting: "Connexion...",
    connect: "Connecter",
    comingSoon: "BientÃ´t disponible",
    loadError: "Impossible de charger les connexions des plateformes.",
    serverError: "Impossible de se connecter au serveur.",
    unavailable: "la connexion n'est pas encore disponible.",
    minimumConnection:
      "Connectez et vÃ©rifiez au moins une plateforme avant de continuer.",
    facebookConnected:
      "Facebook connectÃ© et vÃ©rifiÃ© avec succÃ¨s.",
    instagramVerifying:
      "Autorisation Instagram terminÃ©e. VÃ©rification de la connexion...",
    instagramConnected:
      "Instagram connectÃ© et vÃ©rifiÃ© avec succÃ¨s.",
    instagramNotVisible:
      "L'autorisation Instagram est terminÃ©e, mais le compte connectÃ© n'apparaÃ®t pas encore. Utilisez Actualiser les connexions une fois. S'il reste dÃ©connectÃ©, il faudra vÃ©rifier la rÃ©ponse de /api/platforms.",
    fanvueConnected:
      "Fanvue connectÃ© et vÃ©rifiÃ© avec succÃ¨s.",
    platformDescriptions: {
      FANVUE:
        "Connectez votre compte crÃ©ateur Fanvue et autorisez l'accÃ¨s Ã  la publication.",
      ONLYFANS:
        "GÃ©rez et distribuez le contenu des crÃ©ateurs depuis un espace de travail central.",
      FANSLY:
        "Centralisez les workflows de publication et de distribution du contenu des crÃ©ateurs.",
      MYM:
        "PrÃ©parez le contenu des crÃ©ateurs pour une publication et une gestion simplifiÃ©es.",
      LOYALFANS:
        "Ã‰tendez votre workflow de distribution Ã  une autre plateforme de crÃ©ateurs.",
      INSTAGRAM:
        "Connectez un compte Instagram professionnel avec la connexion officielle Instagram Business.",
      FACEBOOK:
        "Connectez des Pages Facebook pour centraliser la publication et la gestion.",
      MANYVIDS:
        "Connectez et distribuez le contenu des crÃ©ateurs sur ManyVids via la connexion gÃ©rÃ©e par le navigateur.",
      X:
        "Connectez un compte X pour publier et distribuer du contenu.",
      REDDIT:
        "Connectez Reddit pour publier dans les communautÃ©s autorisÃ©es.",
    },
    errors: {
      facebook: {
        denied: "L'autorisation Facebook a Ã©tÃ© annulÃ©e ou refusÃ©e.",
        state: "La connexion Facebook n'a pas pu Ãªtre vÃ©rifiÃ©e de maniÃ¨re sÃ©curisÃ©e. RÃ©essayez.",
        code: "Facebook n'a pas renvoyÃ© de code d'autorisation.",
        creator: "Le crÃ©ateur associÃ© Ã  cette connexion Facebook n'a pas pu Ãªtre identifiÃ©.",
        workspace: "L'espace de travail associÃ© Ã  cette connexion Facebook n'a pas pu Ãªtre identifiÃ©.",
        config: "Facebook n'est pas correctement configurÃ© sur ce serveur. Contactez le support.",
        no_pages: "L'autorisation Facebook a rÃ©ussi, mais aucune Page administrable n'a Ã©tÃ© trouvÃ©e. Connectez un compte Facebook ayant un accÃ¨s complet Ã  au moins une Page.",
        token_exchange: "Facebook a autorisÃ© le compte, mais le jeton d'accÃ¨s n'a pas pu Ãªtre gÃ©nÃ©rÃ©. RÃ©essayez.",
        long_token_exchange: "Facebook est connectÃ©, mais le jeton longue durÃ©e n'a pas pu Ãªtre gÃ©nÃ©rÃ©. RÃ©essayez.",
        pages_fetch: "Facebook est connectÃ©, mais le systÃ¨me n'a pas pu lire les Pages disponibles. VÃ©rifiez les autorisations de la Page et rÃ©essayez.",
        token_encryption: "Facebook est connectÃ©, mais les identifiants sÃ©curisÃ©s n'ont pas pu Ãªtre enregistrÃ©s. Contactez le support.",
        server: "Une erreur inattendue s'est produite lors de la connexion Ã  Facebook. RÃ©essayez ou contactez le support.",
        default: "Impossible de connecter Facebook. RÃ©essayez.",
      },
      instagram: {
        authorization_denied: "L'autorisation Instagram a Ã©tÃ© annulÃ©e ou refusÃ©e.",
        invalid_state: "La connexion Instagram n'a pas pu Ãªtre vÃ©rifiÃ©e de maniÃ¨re sÃ©curisÃ©e. RÃ©essayez.",
        missing_code: "Instagram n'a pas renvoyÃ© de code d'autorisation.",
        missing_creator: "Le crÃ©ateur associÃ© Ã  cette connexion Instagram n'a pas pu Ãªtre identifiÃ©.",
        creator_not_found: "Le crÃ©ateur sÃ©lectionnÃ© est introuvable.",
        configuration: "La configuration de l'intÃ©gration Instagram est incomplÃ¨te.",
        token_exchange: "L'autorisation Instagram a rÃ©ussi, mais l'Ã©change du jeton a Ã©chouÃ©.",
        missing_access_token: "Instagram n'a pas renvoyÃ© de jeton d'accÃ¨s valide.",
        long_token_exchange: "Instagram est connectÃ©, mais le jeton longue durÃ©e n'a pas pu Ãªtre gÃ©nÃ©rÃ©.",
        invalid_long_token: "Instagram a renvoyÃ© un jeton longue durÃ©e invalide.",
        profile_check: "Le compte Instagram n'a pas pu Ãªtre vÃ©rifiÃ© aprÃ¨s l'autorisation.",
        invalid_profile: "Instagram a renvoyÃ© un profil professionnel invalide.",
        internal: "Une erreur interne s'est produite lors de la connexion Ã  Instagram.",
        default: "Impossible de connecter Instagram. RÃ©essayez.",
      },
      fanvue: {
        authorization_denied: "L'autorisation Fanvue a Ã©tÃ© annulÃ©e ou refusÃ©e.",
        invalid_state: "La connexion Fanvue n'a pas pu Ãªtre vÃ©rifiÃ©e de maniÃ¨re sÃ©curisÃ©e. RÃ©essayez.",
        missing_code: "Fanvue n'a pas renvoyÃ© de code d'autorisation.",
        missing_verifier: "La session sÃ©curisÃ©e de connexion Fanvue a expirÃ©. RÃ©essayez.",
        missing_creator: "Le crÃ©ateur associÃ© Ã  cette connexion n'a pas pu Ãªtre identifiÃ©.",
        creator_not_found: "Le crÃ©ateur sÃ©lectionnÃ© est introuvable.",
        configuration: "La configuration de l'intÃ©gration Fanvue est incomplÃ¨te.",
        token_exchange: "L'autorisation Fanvue a rÃ©ussi, mais l'Ã©change du jeton a Ã©chouÃ©.",
        missing_access_token: "Fanvue n'a pas renvoyÃ© de jeton d'accÃ¨s valide.",
        profile_check: "Le compte Fanvue n'a pas pu Ãªtre vÃ©rifiÃ© aprÃ¨s l'autorisation.",
        invalid_profile: "Fanvue a renvoyÃ© un profil crÃ©ateur invalide.",
        internal: "Une erreur interne s'est produite lors de la connexion Ã  Fanvue.",
        default: "Impossible de connecter Fanvue. RÃ©essayez.",
      },
    },
  },
};

const PLATFORM_DISPLAY_ORDER = [
  "FANVUE",
  "ONLYFANS",
  "FANSLY",
  "MYM",
  "LOYALFANS",
  "INSTAGRAM",
  "FACEBOOK",
  "MANYVIDS",
  "X",
  "REDDIT",
];

const FALLBACK_PLATFORMS: PlatformItem[] = [
  {
    code: "FANVUE",
    name: "Fanvue",
    description:
      "Connect your Fanvue creator account and authorize publishing access.",
    connectionMethod: "OAUTH",
    availability: "AVAILABLE",
    officialApi: true,
    colorHint: "violet",
    accounts: [],
    connected: false,
  },
  {
    code: "ONLYFANS",
    name: "OnlyFans",
    description:
      "Manage and distribute creator content from one central workspace.",
    connectionMethod: "PENDING",
    availability: "INTEGRATION_PENDING",
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
    connectionMethod: "PENDING",
    availability: "INTEGRATION_PENDING",
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
    connectionMethod: "PENDING",
    availability: "INTEGRATION_PENDING",
    officialApi: false,
    colorHint: "purple",
    accounts: [],
    connected: false,
  },
  {
    code: "LOYALFANS",
    name: "LoyalFans",
    description:
      "Expand your connected publishing options.",
    connectionMethod: "PENDING",
    availability: "INTEGRATION_PENDING",
    officialApi: false,
    colorHint: "rose",
    accounts: [],
    connected: false,
  },
  {
    code: "INSTAGRAM",
    name: "Instagram",
    description:
      "Connect a professional Instagram account using the official Instagram Business Login.",
    connectionMethod: "OAUTH",
    availability: "AVAILABLE",
    officialApi: true,
    colorHint: "pink",
    accounts: [],
    connected: false,
  },
  {
    code: "FACEBOOK",
    name: "Facebook",
    description:
      "Connect Facebook Pages for centralized publishing and management.",
    connectionMethod: "OAUTH",
    availability: "AVAILABLE",
    officialApi: true,
    colorHint: "blue",
    accounts: [],
    connected: false,
  },
  {
    code: "MANYVIDS",
    name: "ManyVids",
    description:
      "Connect and distribute creator content to ManyVids through the managed browser connection.",
    connectionMethod: "MANAGED_BROWSER",
    availability: "AVAILABLE",
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
    connectionMethod: "OAUTH",
    availability: "INTEGRATION_PENDING",
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
    connectionMethod: "OAUTH",
    availability: "INTEGRATION_PENDING",
    officialApi: true,
    colorHint: "orange",
    accounts: [],
    connected: false,
  },
];

export default function PlatformsOnboardingPage() {
  const locale = useLocale();
  const ui =
    UI[
      locale in UI
        ? (locale as SupportedLocale)
        : "en-US"
    ];
  const router = useRouter();
  const searchParams = useSearchParams();

  const instagramConnectedByCallback =
    searchParams.get(
      "instagram",
    ) === "connected";

  const [platforms, setPlatforms] =
    useState<PlatformItem[]>([]);

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
  ] = useState<string | null>(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const loadPlatforms =
    useCallback(async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response =
          await fetch(
            `/api/platforms?refresh=${Date.now()}`,
            {
              method: "GET",
              cache: "no-store",
              headers: {
                "Cache-Control":
                  "no-cache, no-store, must-revalidate",
              },
            },
          );

        const data: PlatformsResponse =
          await response.json();

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

        const realConnectedCount =
          data.platforms.filter(
            (platform) =>
              platform.accounts.some(
                (account) =>
                  account.status ===
                  "CONNECTED",
              ) ||
              platform.connected,
          ).length;

        setConnectedCount(
          Math.max(
            data.connectedCount,
            realConnectedCount,
          ),
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
        setIsLoading(false);
      }
    }, [ui.loadError, ui.serverError]);

  const verifyConnectedPlatform =
    useCallback(
      async (
        platformCode: string,
      ) => {
        for (
          let attempt = 0;
          attempt < 8;
          attempt += 1
        ) {
          try {
            const response =
              await fetch(
                `/api/platforms?refresh=${Date.now()}-${attempt}`,
                {
                  method: "GET",
                  cache: "no-store",
                  headers: {
                    "Cache-Control":
                      "no-cache, no-store, must-revalidate",
                  },
                },
              );

            const data: PlatformsResponse =
              await response.json();

            if (
              response.ok &&
              data.success
            ) {
              setPlatforms(
                data.platforms,
              );

              const realConnectedCount =
                data.platforms.filter(
                  (platform) =>
                    platform.accounts.some(
                      (account) =>
                        account.status ===
                        "CONNECTED",
                    ) ||
                    platform.connected,
                ).length;

              setConnectedCount(
                Math.max(
                  data.connectedCount,
                  realConnectedCount,
                ),
              );

              const connected =
                data.platforms.some(
                  (platform) =>
                    platform.code ===
                      platformCode &&
                    (
                      platform.connected ||
                      platform.accounts.some(
                        (account) =>
                          account.status ===
                          "CONNECTED",
                      )
                    ),
                );

              if (connected) {
                return true;
              }
            }
          } catch (error) {
            console.error(
              "PLATFORM_VERIFY_RETRY_ERROR",
              error,
            );
          }

          await new Promise(
            (resolve) =>
              window.setTimeout(
                resolve,
                700,
              ),
          );
        }

        return false;
      },
      [],
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

      setErrorMessage("");

      void loadPlatforms();

      return;
    }

    if (
      facebookStatus ===
      "error"
    ) {
      setSuccessMessage("");

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
      setPlatforms(
        (currentPlatforms) =>
          currentPlatforms.map(
            (platform) => {
              if (
                platform.code !==
                "INSTAGRAM"
              ) {
                return platform;
              }

              const existingAccounts =
                platform.accounts.length >
                0
                  ? platform.accounts.map(
                      (account) => ({
                        ...account,
                        status:
                          "CONNECTED",
                      }),
                    )
                  : [
                      {
                        id:
                          "instagram-connected",
                        creatorId:
                          null,
                        platform:
                          "INSTAGRAM",
                        platformName:
                          "Instagram",
                        status:
                          "CONNECTED",
                        externalAccountId:
                          null,
                        externalUsername:
                          null,
                        externalDisplayName:
                          null,
                        connectionType:
                          "OAUTH",
                        lastVerifiedAt:
                          null,
                        lastSyncAt:
                          null,
                        lastErrorCode:
                          null,
                        lastErrorMessage:
                          null,
                      },
                    ];

              return {
                ...platform,
                connected: true,
                accounts:
                  existingAccounts,
              };
            },
          ),
      );

      setConnectedCount(
        (currentCount) =>
          Math.max(
            currentCount,
            1,
          ),
      );

      setSuccessMessage(
        ui.instagramConnected,
      );

      setErrorMessage("");

      void verifyConnectedPlatform(
        "INSTAGRAM",
      );

      return;
    }

    if (
      instagramStatus ===
      "error"
    ) {
      setSuccessMessage("");

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

      setErrorMessage("");

      void loadPlatforms();

      return;
    }

    if (
      fanvueStatus ===
      "error"
    ) {
      setSuccessMessage("");

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
    verifyConnectedPlatform,
    ui,
  ]);

  useEffect(() => {
    void loadPlatforms();
  }, [loadPlatforms]);

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

          const basePlatform =
            backendPlatform ??
            FALLBACK_PLATFORMS.find(
              (platform) =>
                platform.code ===
                code,
            )!;

          if (
            code === "INSTAGRAM" &&
            instagramConnectedByCallback
          ) {
            const hasConnectedAccount =
              basePlatform.accounts.some(
                (account) =>
                  account.status ===
                  "CONNECTED",
              );

            return {
              ...basePlatform,
              connected: true,
              accounts:
                hasConnectedAccount
                  ? basePlatform.accounts
                  : [
                      ...basePlatform.accounts,
                      {
                        id:
                          "instagram-callback-connected",
                        creatorId:
                          null,
                        platform:
                          "INSTAGRAM",
                        platformName:
                          "Instagram",
                        status:
                          "CONNECTED",
                        externalAccountId:
                          null,
                        externalUsername:
                          null,
                        externalDisplayName:
                          null,
                        connectionType:
                          "OAUTH",
                        lastVerifiedAt:
                          null,
                        lastSyncAt:
                          null,
                        lastErrorCode:
                          null,
                        lastErrorMessage:
                          null,
                      },
                    ],
            };
          }

          return basePlatform;
        },
      );
    }, [
      platforms,
      instagramConnectedByCallback,
    ]);

  function connectPlatform(
    platform: PlatformItem,
  ) {
    if (
      platform.connected
    ) {
      return;
    }

    if (
      platform.availability !==
      "AVAILABLE"
    ) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

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
        `/api/platforms/instagram/connect?locale=${encodeURIComponent(locale)}`;

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

    if (
      platform.code ===
      "MANYVIDS"
    ) {
      setIsConnecting(
        "MANYVIDS",
      );

      window.location.href =
        `/api/platforms/manyvids/connect?locale=${encodeURIComponent(
          locale,
        )}`;

      return;
    }

    setErrorMessage(
      `${platform.name} ${ui.unavailable}`,
    );
  }

  const effectiveConnectedCount =
    Math.max(
      connectedCount,
      instagramConnectedByCallback
        ? 1
        : 0,
    );

  function continueSetup() {
    if (
      effectiveConnectedCount < 1
    ) {
      setErrorMessage(
        ui.minimumConnection,
      );

      return;
    }

    router.push(
      `/onboarding/check`,
    );
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <div className="min-h-screen px-5 py-8 sm:px-7 lg:px-8">
        <div className="mx-auto w-full max-w-[1180px]">

          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/onboarding/creators`,
                )
              }
              className="flex items-center gap-2 text-sm text-white/40 transition hover:text-white/70"
            >
              <ArrowLeft className="h-4 w-4" />
              {ui.back}
            </button>

            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
              {ui.step}
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.025] shadow-2xl shadow-black/20">

            <div className="border-b border-white/[0.07] px-6 py-7 sm:px-8 lg:px-10">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/[0.06] px-3 py-1 text-[11px] font-medium text-blue-300">
                    <Globe2 className="h-3.5 w-3.5" />
                    {ui.network}
                  </div>

                  <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-[34px]">
                    {ui.title}
                  </h1>

                  <p className="mt-2 max-w-[700px] text-sm leading-6 text-white/40">
                    {ui.subtitle}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0b0f17] px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/[0.1]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-[0.12em] text-white/30">
                      {ui.connected}
                    </div>

                    <div className="mt-0.5 text-xl font-semibold">
                      {connectedCount}
                      <span className="ml-1 text-xs font-normal text-white/25">
                        / {displayedPlatforms.length}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="px-6 py-6 sm:px-8 lg:px-10">

              {successMessage && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {successMessage}
                  </span>
                </div>
              )}

              {errorMessage && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {errorMessage}
                  </span>
                </div>
              )}

              {isLoading ? (
                <div className="flex min-h-[360px] items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-400" />

                    <div className="mt-3 text-sm text-white/40">
                      {ui.loading}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {displayedPlatforms.map(
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
                        ui={ui}
                      />
                    ),
                  )}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.07] pt-6 sm:flex-row">

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
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/50 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RefreshCw className="h-4 w-4" />
                  {ui.refresh}
                </button>

                <button
                  type="button"
                  onClick={
                    continueSetup
                  }
                  disabled={
                    effectiveConnectedCount <
                      1 ||
                    Boolean(
                      isConnecting,
                    )
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#080b12] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {ui.continue}
                  <ArrowRight className="h-4 w-4" />
                </button>

              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/25">
                <ShieldCheck className="h-3.5 w-3.5" />
                {ui.requirement}
              </div>

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function PlatformCard({
  platform,
  isConnecting,
  onConnect,
  ui,
}: {
  platform: PlatformItem;
  isConnecting: boolean;
  onConnect: () => void;
  ui: UIStrings;
}) {
  const connectedAccount =
    platform.accounts.find(
      (account) =>
        account.status ===
        "CONNECTED",
    );

  const isConnected =
    Boolean(
      connectedAccount,
    );

  const isAvailable =
    platform.availability ===
    "AVAILABLE";

  return (
    <div
      className={`group relative flex min-h-[235px] flex-col overflow-hidden rounded-2xl border p-4 transition-all duration-200 ${
        isConnected
          ? "border-emerald-500/30 bg-emerald-500/[0.04] shadow-[0_0_30px_rgba(16,185,129,0.04)]"
          : "border-white/[0.08] bg-[#0b0f17]/80 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.035]"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="flex items-start justify-between gap-3">

        <div className="flex items-center gap-3">

          <PlatformIcon
            code={
              platform.code
            }
            connected={
              isConnected
            }
          />

          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.015em]">
              {platform.name}
            </h2>

            <div className="mt-1 flex flex-wrap items-center gap-1.5">

              {platform.officialApi && (
                <span className="rounded-full border border-blue-500/15 bg-blue-500/[0.07] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-blue-300">
                  {ui.officialApi}
                </span>
              )}

              {isConnected && (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-300">
                  {ui.verified}
                </span>
              )}

            </div>
          </div>

        </div>

        <StatusIndicator
          connected={
            isConnected
          }
          available={
            isAvailable
          }
        />

      </div>

      <p className="mt-4 min-h-[40px] text-[12px] leading-5 text-white/35">
        {ui.platformDescriptions[platform.code] ?? platform.description}
      </p>

      <div className="mt-auto pt-4">

        <div className="mb-3 flex min-h-[39px] items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">

          <div>
            <div className="text-[9px] uppercase tracking-[0.1em] text-white/25">
              {ui.status}
            </div>

            <div
              className={`mt-0.5 text-xs font-medium ${
                isConnected
                  ? "text-emerald-300"
                  : isAvailable
                    ? "text-white/55"
                    : "text-white/30"
              }`}
            >
              {isConnected
                ? ui.connected
                : isAvailable
                  ? ui.readyToConnect
                  : "Integration pending"}
            </div>
          </div>

          {connectedAccount?.externalUsername ? (
            <div className="max-w-[120px] truncate text-right text-[11px] text-white/35">
              @
              {
                connectedAccount.externalUsername
              }
            </div>
          ) : connectedAccount?.externalDisplayName ? (
            <div className="max-w-[120px] truncate text-right text-[11px] text-white/35">
              {
                connectedAccount.externalDisplayName
              }
            </div>
          ) : (
            <LockKeyhole className="h-3.5 w-3.5 text-white/15" />
          )}

        </div>

        <button
          type="button"
          onClick={
            onConnect
          }
          disabled={
            !isAvailable ||
            isConnected ||
            isConnecting
          }
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
            isConnected
              ? "border border-emerald-500/15 bg-emerald-500/[0.07] text-emerald-300"
              : isAvailable
                ? "border border-white/10 bg-white/[0.06] text-white/75 hover:bg-white/[0.1] hover:text-white"
                : "border border-white/[0.06] bg-white/[0.02] text-white/25"
          } disabled:cursor-not-allowed`}
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {ui.connecting}
            </>
          ) : isConnected ? (
            <>
              <Check className="h-3.5 w-3.5" />
              {ui.connected}
            </>
          ) : isAvailable ? (
            <>
              {ui.connect}
              <ExternalLink className="h-3.5 w-3.5" />
            </>
          ) : (
            ui.comingSoon
          )}
        </button>

      </div>
    </div>
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

  const baseClass =
    connected
      ? "border-emerald-500/20 bg-emerald-500/[0.08]"
      : "border-white/10 bg-white/[0.04]";

  if (icon) {
    const brandColor =
      `#${icon.hex}`;

    const needsLightBackground =
      shouldUseLightBadgeBackground(
        icon.hex,
      );

    return (
      <div
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${baseClass}`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-20 blur-xl"
          style={{
            backgroundColor:
              brandColor,
          }}
        />

        <div
          className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${
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
            className="h-5 w-5"
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
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[12px] font-bold tracking-[-0.02em] ${
        connected
          ? "text-emerald-300"
          : "text-white/70"
      } ${baseClass}`}
    >
      {getPlatformMonogram(
        code,
      )}
    </div>
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

  const keys: Record<
    string,
    string[]
  > = {
    INSTAGRAM: [
      "siInstagram",
    ],

    FACEBOOK: [
      "siFacebook",
    ],

    MANYVIDS: [
      "siManyvids",
      "siManyVids",
    ],

    X: [
      "siX",
    ],

    REDDIT: [
      "siReddit",
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
      .replace("#", "")
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

function StatusIndicator({
  connected,
  available,
}: {
  connected: boolean;
  available: boolean;
}) {
  if (connected) {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/[0.1]">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      </div>
    );
  }

  if (available) {
    return (
      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.55)]" />
    );
  }

  return (
    <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-white/15" />
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

    case "MANYVIDS":
      return "MV";

    case "X":
      return "X";

    case "REDDIT":
      return "r/";

    default:
      return code.slice(
        0,
        2,
      );
  }
}

function getFacebookErrorMessage(
  reason: string | null,
  ui: UIStrings,
) {
  if (!reason) {
    return ui.errors.facebook.default;
  }

  return (
    ui.errors.facebook[reason] ??
    ui.errors.facebook.default
  );
}

function getInstagramErrorMessage(
  reason: string | null,
  ui: UIStrings,
) {
  if (!reason) {
    return ui.errors.instagram.default;
  }

  return (
    ui.errors.instagram[reason] ??
    ui.errors.instagram.default
  );
}

function getFanvueErrorMessage(
  reason: string | null,
  ui: UIStrings,
) {
  if (!reason) {
    return ui.errors.fanvue.default;
  }

  return (
    ui.errors.fanvue[reason] ??
    ui.errors.fanvue.default
  );
}

