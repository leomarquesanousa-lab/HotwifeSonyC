"use client";

import { scheduledUtc, validTimeZone, wallTime } from "@/src/lib/distribution/schedule-time";
import type { LocalOptions } from "@/src/lib/platforms/manyvids/http/local-options";
import { useManyVidsDraft } from "@/src/components/app/useManyVidsDraft";
import { ManyVidsTagPicker } from "@/src/components/app/ManyVidsTagPicker";
import { useTranslations } from "next-intl";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useParams } from "next/navigation";
import { ManyVidsPublishingOptions, emptyManyVidsOptions } from "@/src/components/app/ManyVidsPublishingOptions";
import { publishInputSchema } from "@/src/lib/platforms/manyvids/http/types";
import { missingVideoMetadataFields } from "@/src/lib/media/video-metadata";

import {
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileVideo2,
  ImageIcon,
  Loader2,
  Search,
  Send,
  Sparkles,
  Tag,
  UserRound,
  X,
  Zap,
} from "lucide-react";

type Creator = {
  id: string;
  displayName?: string | null;
  name?: string | null;
  stageName?: string | null;
};

type MediaAsset = {
  id: string;
  creatorId: string;
  folderId?: string | null;
  originalFileName: string;
  fileSize: string;
  mediaType: string;
  status: string;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  createdAt?: string;
  categories?: MediaCategory[];
};

type PlatformAccount = {
  id: string;
  creatorId: string;
  platform: string;
  status: string;
  externalAccountId?: string | null;
  externalUsername?: string | null;
  externalDisplayName?: string | null;
  displayName?: string | null;
};

type OptionsResponse = {
  timeZone?: string;
  success: boolean;
  creators?: Creator[];
  media?: MediaAsset[];
  mediaCategories?: MediaCategory[];
  platformAccounts?: PlatformAccount[];
  accounts?: PlatformAccount[];
  error?: string;
};

type Performer = {
  id: string;
  displayName: string;
  status?: string;
};

type PerformersResponse = {
  success: boolean;
  performers?: Performer[];
  error?: string;
  message?: string;
};

type LibraryFolder = {
  id: string;
  parentId: string | null;
  name: string;
  normalizedName: string;
  folderType: string;
  systemKey: string | null;
  isSystem: boolean;
  isRequired: boolean;
  sortOrder: number;
  status: string;
};

type PerformerLibraryResponse = {
  success: boolean;
  folders?: LibraryFolder[];
  error?: string;
};

type PerformerMediaResponse = {
  success: boolean;
  media?: MediaAsset[];
  total?: number;
  error?: string;
};

type DistributionPublication = {
  id: string;
  platform: string;
  status: string;
  platformAccountId?: string;
};

type DistributionResponse = {
  success: boolean;
  job?: {
    id: string;
    status: string;
  };
  publications?: DistributionPublication[];
  error?: string;
};

type ExecuteInstagramResponse = {
  success: boolean;
  publicationId?: string;
  status?: string;
  publishType?: string;
  containerId?: string;
  externalPostId?: string;
  error?: string;
  message?: string;
};

type InstagramPublishType =
  | "POST"
  | "REEL"
  | "STORY";

type InstagramAccountProgress = {
  status:
    | "WAITING"
    | "PUBLISHING"
    | "PUBLISHED"
    | "FAILED";
  progress: number;
  message?: string;
};

type ExecuteManyVidsResponse = {
  success: boolean;
  status?: string;
  externalPostId?: string;
  externalPostUrl?: string;
  fileName?: string;
  currentUrl?: string;
  error?: string;
  message?: string;
};

type PreviewResponse = {
  success: boolean;
  previewUrl?: string;
  error?: string;
};

type ThumbnailSaveResponse = {
  success: boolean;
  mediaId?: string;
  thumbnailObjectKey?: string;
  thumbnailUrl?: string;
  error?: string;
  message?: string;
};

type AiThumbnailResponse = {
  success: boolean;
  mediaId?: string;
  thumbnailObjectKey?: string;
  thumbnailUrl?: string;
  model?: string;
  size?: string;
  error?: string;
  message?: string;
};


type MediaCategory = {
  id: string;
  name: string;
  normalizedName: string;
  createdAt?: string;
};

type CategoriesResponse = {
  success: boolean;
  categories?: MediaCategory[];
  error?: string;
  message?: string;
};

type MediaCategoriesResponse = {
  success: boolean;
  categories?: MediaCategory[];
  error?: string;
  message?: string;
};

type AiCaptionResponse = {
  success: boolean;
  caption?: string;
  hashtags?: string[];
  error?: string;
};

type AiPlatformCaption = {
  platformAccountId: string;
  platform: string;
  caption: string;
  hashtags: string[];
};

type AiPlatformCaptionsResponse = {
  success: boolean;
  captions?: AiPlatformCaption[];
  error?: string;
};

const PLATFORM_ORDER = [
  "INSTAGRAM",
  "FANVUE",
  "FACEBOOK",
  "X",
  "REDDIT",
  "MANYVIDS",
  "PORNHUB",
  "ONLYFANS",
  "FANSLY",
  "LOYALFANS",
];

const PLATFORM_LABELS:
  Record<string, string> = {
    INSTAGRAM:
      "Instagram",
    FANVUE:
      "Fanvue",
    FACEBOOK:
      "Facebook",
    X:
      "X",
    REDDIT:
      "Reddit",
    MANYVIDS:
      "ManyVids",
    PORNHUB:
      "Pornhub",
    ONLYFANS:
      "OnlyFans",
    FANSLY:
      "Fansly",
    LOYALFANS:
      "LoyalFans",
  };



const DISTRIBUTION_COPY: Record<string, Record<string, string>> = {
  "en-US": {performerMedia:"Performer & Media",performer:"Performer",choosePerformer:"Choose a performer",folder:"Folder",allFolders:"All folders",noPerformerSelected:"Select a performer to browse their media.",noMediaForPerformer:"No media found for this performer.",loadPerformersError:"Unable to load performers.",loadPerformerMediaError:"Unable to load performer media.",loadFoldersError:"Unable to load performer folders.",loadOptionsError:"Unable to load publishing options.",selectVideoBeforeAi:"Select a video before generating with AI.",generateCaptionError:"Unable to generate caption.",aiCaptionSuccess:"AI caption generated. Review it before publishing.",selectPlatformBeforeAi:"Select at least one platform before generating per-platform captions.",generatePlatformCaptionsError:"Unable to generate platform captions.",platformCaptionsSuccess:"AI generated platform-specific captions. Review them before publishing.",selectCreator:"Select a creator.",selectVideo:"Select a video.",selectPlatform:"Select at least one platform.",choosePublishingDateTime:"Choose the publishing date and time.",createDistributionError:"Unable to create distribution.",distributionScheduled:"Distribution scheduled successfully.",publishingInstagram:"Distribution created. Publishing to Instagram...",instagramFailed:"Instagram publication failed.",instagramSuccess:"Instagram published successfully.",distributionCreated:"Distribution created successfully.",loadingWorkspace:"Loading publishing workspace...",title:"Publish Everywhere",subtitle:"Select once. Publish across your connected platforms.",creatorMedia:"Creator & Media",creator:"Creator",media:"Media",chooseVideo:"Choose a video",readyToPublish:"Ready to publish",videoAvailable:"video available",videosAvailable:"videos available",change:"Change",choose:"Choose",selectAVideo:"Select a video",captionPublishing:"Caption & Publishing",aiContext:"AI context",aiPlaceholder:"Example: sunset beach shoot, playful and elegant",generating:"Generating...",generateAi:"Generate with AI",aiHelp:"AI uses the selected video name, your context and selected platforms to suggest a caption and hashtags.",captionPlaceholder:"Write your caption...",generalCaptionHelp:"Use one general caption or generate a custom version for each selected platform.",generatingPerPlatform:"Generating per platform...",generatePerPlatform:"Generate per platform",customCaptionFor:"Custom caption for",publishNow:"Publish now",schedule:"Schedule",scheduledPublication:"Scheduled publication",selectPlatforms:"Select Platforms",chooseDestinations:"Choose the destinations for this publication.",connected:"connected",noConnectedPlatforms:"No connected platforms for this creator.",connectedLabel:"Connected",publishingSummary:"Publishing Summary",noDestination:"No destination selected.",destinationSelected:"destination selected.",destinationsSelected:"destinations selected.",publishing:"Publishing...",chooseVideoTitle:"Choose video",pickMedia:"Pick media from this creator's library.",searchVideos:"Search videos...",allCategories:"All categories",loadingPreviews:"Loading video previews...",noVideosFound:"No videos found",tryAnother:"Try another search or category.",ready:"Ready",of:"of",videos:"videos",close:"Close",schedulePublication:"Schedule publication",scheduleHelp:"Choose when your content should be published.",today:"Today",tomorrow:"Tomorrow",nextWeek:"Next week",time:"Time",quickTime:"Quick time",publicationTime:"Publication time",cancel:"Cancel",confirmSchedule:"Confirm schedule",chooseDateTime:"Choose a date and time",creatorFallback:"Creator",queuedOther:"other publication(s) remain queued."},
  "pt-BR": {performerMedia:"Performer e Mídia",performer:"Performer",choosePerformer:"Escolha um performer",folder:"Pasta",allFolders:"Todas as pastas",noPerformerSelected:"Selecione um performer para navegar pelas mídias.",noMediaForPerformer:"Nenhuma mídia encontrada para este performer.",loadPerformersError:"Não foi possível carregar os performers.",loadPerformerMediaError:"Não foi possível carregar as mídias do performer.",loadFoldersError:"Não foi possível carregar as pastas do performer.",loadOptionsError:"Não foi possível carregar as opções de publicação.",selectVideoBeforeAi:"Selecione um vídeo antes de gerar com IA.",generateCaptionError:"Não foi possível gerar a legenda.",aiCaptionSuccess:"Legenda gerada por IA. Revise antes de publicar.",selectPlatformBeforeAi:"Selecione pelo menos uma plataforma antes de gerar legendas por plataforma.",generatePlatformCaptionsError:"Não foi possível gerar legendas por plataforma.",platformCaptionsSuccess:"A IA gerou legendas específicas por plataforma. Revise antes de publicar.",selectCreator:"Selecione um criador.",selectVideo:"Selecione um vídeo.",selectPlatform:"Selecione pelo menos uma plataforma.",choosePublishingDateTime:"Escolha a data e o horário da publicação.",createDistributionError:"Não foi possível criar a distribuição.",distributionScheduled:"Distribuição agendada com sucesso.",publishingInstagram:"Distribuição criada. Publicando no Instagram...",instagramFailed:"Falha ao publicar no Instagram.",instagramSuccess:"Publicado no Instagram com sucesso.",distributionCreated:"Distribuição criada com sucesso.",loadingWorkspace:"Carregando área de publicação...",title:"Publicar em Todo Lugar",subtitle:"Selecione uma vez. Publique em todas as plataformas conectadas.",creatorMedia:"Criador e Mídia",creator:"Criador",media:"Mídia",chooseVideo:"Escolher um vídeo",readyToPublish:"Pronto para publicar",videoAvailable:"vídeo disponível",videosAvailable:"vídeos disponíveis",change:"Alterar",choose:"Escolher",selectAVideo:"Selecione um vídeo",captionPublishing:"Legenda e Publicação",aiContext:"Contexto para IA",aiPlaceholder:"Exemplo: ensaio na praia ao pôr do sol, divertido e elegante",generating:"Gerando...",generateAi:"Gerar com IA",aiHelp:"A IA usa o nome do vídeo, seu contexto e as plataformas selecionadas para sugerir uma legenda e hashtags.",captionPlaceholder:"Escreva sua legenda...",generalCaptionHelp:"Use uma legenda geral ou gere uma versão personalizada para cada plataforma selecionada.",generatingPerPlatform:"Gerando por plataforma...",generatePerPlatform:"Gerar por plataforma",customCaptionFor:"Legenda personalizada para",publishNow:"Publicar agora",schedule:"Agendar",scheduledPublication:"Publicação agendada",selectPlatforms:"Selecionar Plataformas",chooseDestinations:"Escolha os destinos desta publicação.",connected:"conectadas",noConnectedPlatforms:"Nenhuma plataforma conectada para este criador.",connectedLabel:"Conectado",publishingSummary:"Resumo da Publicação",noDestination:"Nenhum destino selecionado.",destinationSelected:"destino selecionado.",destinationsSelected:"destinos selecionados.",publishing:"Publicando...",chooseVideoTitle:"Escolher vídeo",pickMedia:"Escolha uma mídia da biblioteca deste criador.",searchVideos:"Buscar vídeos...",allCategories:"Todas as categorias",loadingPreviews:"Carregando prévias dos vídeos...",noVideosFound:"Nenhum vídeo encontrado",tryAnother:"Tente outra busca ou categoria.",ready:"Pronto",of:"de",videos:"vídeos",close:"Fechar",schedulePublication:"Agendar publicação",scheduleHelp:"Escolha quando seu conteúdo deve ser publicado.",today:"Hoje",tomorrow:"Amanhã",nextWeek:"Próxima semana",time:"Horário",quickTime:"Horário rápido",publicationTime:"Horário da publicação",cancel:"Cancelar",confirmSchedule:"Confirmar agendamento",chooseDateTime:"Escolha uma data e um horário",creatorFallback:"Criador",queuedOther:"outra(s) publicação(ões) permanecem na fila."},
  "es-ES": {performerMedia:"Performer y Multimedia",performer:"Performer",choosePerformer:"Elige un performer",folder:"Carpeta",allFolders:"Todas las carpetas",noPerformerSelected:"Selecciona un performer para explorar sus medios.",noMediaForPerformer:"No se encontraron medios para este performer.",loadPerformersError:"No se pudieron cargar los performers.",loadPerformerMediaError:"No se pudieron cargar los medios del performer.",loadFoldersError:"No se pudieron cargar las carpetas del performer.",loadOptionsError:"No se pudieron cargar las opciones de publicación.",selectVideoBeforeAi:"Selecciona un video antes de generar con IA.",generateCaptionError:"No se pudo generar el texto.",aiCaptionSuccess:"Texto generado por IA. Revísalo antes de publicar.",selectPlatformBeforeAi:"Selecciona al menos una plataforma antes de generar textos por plataforma.",generatePlatformCaptionsError:"No se pudieron generar textos por plataforma.",platformCaptionsSuccess:"La IA generó textos específicos por plataforma. Revísalos antes de publicar.",selectCreator:"Selecciona un creador.",selectVideo:"Selecciona un video.",selectPlatform:"Selecciona al menos una plataforma.",choosePublishingDateTime:"Elige la fecha y hora de publicación.",createDistributionError:"No se pudo crear la distribución.",distributionScheduled:"Distribución programada correctamente.",publishingInstagram:"Distribución creada. Publicando en Instagram...",instagramFailed:"Falló la publicación en Instagram.",instagramSuccess:"Publicado en Instagram correctamente.",distributionCreated:"Distribución creada correctamente.",loadingWorkspace:"Cargando espacio de publicación...",title:"Publicar en Todas Partes",subtitle:"Selecciona una vez. Publica en todas tus plataformas conectadas.",creatorMedia:"Creador y Multimedia",creator:"Creador",media:"Multimedia",chooseVideo:"Elegir un video",readyToPublish:"Listo para publicar",videoAvailable:"video disponible",videosAvailable:"videos disponibles",change:"Cambiar",choose:"Elegir",selectAVideo:"Selecciona un video",captionPublishing:"Texto y Publicación",aiContext:"Contexto para IA",aiPlaceholder:"Ejemplo: sesión en la playa al atardecer, divertida y elegante",generating:"Generando...",generateAi:"Generar con IA",aiHelp:"La IA usa el nombre del video, tu contexto y las plataformas seleccionadas para sugerir un texto y hashtags.",captionPlaceholder:"Escribe tu texto...",generalCaptionHelp:"Usa un texto general o genera una versión personalizada para cada plataforma seleccionada.",generatingPerPlatform:"Generando por plataforma...",generatePerPlatform:"Generar por plataforma",customCaptionFor:"Texto personalizado para",publishNow:"Publicar ahora",schedule:"Programar",scheduledPublication:"Publicación programada",selectPlatforms:"Seleccionar Plataformas",chooseDestinations:"Elige los destinos de esta publicación.",connected:"conectadas",noConnectedPlatforms:"No hay plataformas conectadas para este creador.",connectedLabel:"Conectado",publishingSummary:"Resumen de Publicación",noDestination:"Ningún destino seleccionado.",destinationSelected:"destino seleccionado.",destinationsSelected:"destinos seleccionados.",publishing:"Publicando...",chooseVideoTitle:"Elegir video",pickMedia:"Elige contenido de la biblioteca de este creador.",searchVideos:"Buscar videos...",allCategories:"Todas las categorías",loadingPreviews:"Cargando vistas previas...",noVideosFound:"No se encontraron videos",tryAnother:"Prueba otra búsqueda o categoría.",ready:"Listo",of:"de",videos:"videos",close:"Cerrar",schedulePublication:"Programar publicación",scheduleHelp:"Elige cuándo debe publicarse tu contenido.",today:"Hoy",tomorrow:"Mañana",nextWeek:"Próxima semana",time:"Hora",quickTime:"Hora rápida",publicationTime:"Hora de publicación",cancel:"Cancelar",confirmSchedule:"Confirmar programación",chooseDateTime:"Elige una fecha y hora",creatorFallback:"Creador",queuedOther:"otra(s) publicación(es) permanecen en cola."},
  "fr-FR": {performerMedia:"Performer et Média",performer:"Performer",choosePerformer:"Choisir un performer",folder:"Dossier",allFolders:"Tous les dossiers",noPerformerSelected:"Sélectionnez un performer pour parcourir ses médias.",noMediaForPerformer:"Aucun média trouvé pour ce performer.",loadPerformersError:"Impossible de charger les performers.",loadPerformerMediaError:"Impossible de charger les médias du performer.",loadFoldersError:"Impossible de charger les dossiers du performer.",loadOptionsError:"Impossible de charger les options de publication.",selectVideoBeforeAi:"Sélectionnez une vidéo avant de générer avec l’IA.",generateCaptionError:"Impossible de générer la légende.",aiCaptionSuccess:"Légende générée par l’IA. Vérifiez-la avant de publier.",selectPlatformBeforeAi:"Sélectionnez au moins une plateforme avant de générer des légendes par plateforme.",generatePlatformCaptionsError:"Impossible de générer les légendes par plateforme.",platformCaptionsSuccess:"L’IA a généré des légendes spécifiques par plateforme. Vérifiez-les avant de publier.",selectCreator:"Sélectionnez un créateur.",selectVideo:"Sélectionnez une vidéo.",selectPlatform:"Sélectionnez au moins une plateforme.",choosePublishingDateTime:"Choisissez la date et l’heure de publication.",createDistributionError:"Impossible de créer la distribution.",distributionScheduled:"Distribution programmée avec succès.",publishingInstagram:"Distribution créée. Publication sur Instagram...",instagramFailed:"Échec de la publication sur Instagram.",instagramSuccess:"Publication sur Instagram réussie.",distributionCreated:"Distribution créée avec succès.",loadingWorkspace:"Chargement de l’espace de publication...",title:"Publier Partout",subtitle:"Sélectionnez une fois. Publiez sur toutes vos plateformes connectées.",creatorMedia:"Créateur et Média",creator:"Créateur",media:"Média",chooseVideo:"Choisir une vidéo",readyToPublish:"Prêt à publier",videoAvailable:"vidéo disponible",videosAvailable:"vidéos disponibles",change:"Modifier",choose:"Choisir",selectAVideo:"Sélectionnez une vidéo",captionPublishing:"Légende et Publication",aiContext:"Contexte IA",aiPlaceholder:"Exemple : séance plage au coucher du soleil, ludique et élégante",generating:"Génération...",generateAi:"Générer avec l’IA",aiHelp:"L’IA utilise le nom de la vidéo, votre contexte et les plateformes sélectionnées pour suggérer une légende et des hashtags.",captionPlaceholder:"Écrivez votre légende...",generalCaptionHelp:"Utilisez une légende générale ou générez une version personnalisée pour chaque plateforme sélectionnée.",generatingPerPlatform:"Génération par plateforme...",generatePerPlatform:"Générer par plateforme",customCaptionFor:"Légende personnalisée pour",publishNow:"Publier maintenant",schedule:"Programmer",scheduledPublication:"Publication programmée",selectPlatforms:"Sélectionner les Plateformes",chooseDestinations:"Choisissez les destinations de cette publication.",connected:"connectées",noConnectedPlatforms:"Aucune plateforme connectée pour ce créateur.",connectedLabel:"Connecté",publishingSummary:"Résumé de Publication",noDestination:"Aucune destination sélectionnée.",destinationSelected:"destination sélectionnée.",destinationsSelected:"destinations sélectionnées.",publishing:"Publication...",chooseVideoTitle:"Choisir une vidéo",pickMedia:"Choisissez un média dans la bibliothèque de ce créateur.",searchVideos:"Rechercher des vidéos...",allCategories:"Toutes les catégories",loadingPreviews:"Chargement des aperçus vidéo...",noVideosFound:"Aucune vidéo trouvée",tryAnother:"Essayez une autre recherche ou catégorie.",ready:"Prêt",of:"sur",videos:"vidéos",close:"Fermer",schedulePublication:"Programmer la publication",scheduleHelp:"Choisissez quand votre contenu doit être publié.",today:"Aujourd’hui",tomorrow:"Demain",nextWeek:"Semaine prochaine",time:"Heure",quickTime:"Heure rapide",publicationTime:"Heure de publication",cancel:"Annuler",confirmSchedule:"Confirmer la programmation",chooseDateTime:"Choisissez une date et une heure",creatorFallback:"Créateur",queuedOther:"autre(s) publication(s) restent en file d’attente."},
  "cs-CZ": {performerMedia:"Performer a Média",performer:"Performer",choosePerformer:"Vyberte performera",folder:"Složka",allFolders:"Všechny složky",noPerformerSelected:"Vyberte performera pro procházení médií.",noMediaForPerformer:"Pro tohoto performera nebyla nalezena žádná média.",loadPerformersError:"Performery se nepodařilo načíst.",loadPerformerMediaError:"Média performera se nepodařilo načíst.",loadFoldersError:"Složky performera se nepodařilo načíst.",loadOptionsError:"Možnosti publikování se nepodařilo načíst.",selectVideoBeforeAi:"Před generováním pomocí AI vyberte video.",generateCaptionError:"Popisek se nepodařilo vygenerovat.",aiCaptionSuccess:"AI vygenerovala popisek. Před publikováním jej zkontrolujte.",selectPlatformBeforeAi:"Před generováním popisků pro jednotlivé platformy vyberte alespoň jednu platformu.",generatePlatformCaptionsError:"Popisky pro platformy se nepodařilo vygenerovat.",platformCaptionsSuccess:"AI vygenerovala popisky pro jednotlivé platformy. Před publikováním je zkontrolujte.",selectCreator:"Vyberte tvůrce.",selectVideo:"Vyberte video.",selectPlatform:"Vyberte alespoň jednu platformu.",choosePublishingDateTime:"Vyberte datum a čas publikování.",createDistributionError:"Distribuci se nepodařilo vytvořit.",distributionScheduled:"Distribuce byla úspěšně naplánována.",publishingInstagram:"Distribuce vytvořena. Publikuji na Instagram...",instagramFailed:"Publikování na Instagram selhalo.",instagramSuccess:"Publikování na Instagram proběhlo úspěšně.",distributionCreated:"Distribuce byla úspěšně vytvořena.",loadingWorkspace:"Načítání publikačního prostoru...",title:"Publikovat Všude",subtitle:"Vyberte jednou. Publikujte na všech připojených platformách.",creatorMedia:"Tvůrce a Média",creator:"Tvůrce",media:"Média",chooseVideo:"Vybrat video",readyToPublish:"Připraveno k publikování",videoAvailable:"video k dispozici",videosAvailable:"videa k dispozici",change:"Změnit",choose:"Vybrat",selectAVideo:"Vyberte video",captionPublishing:"Popisek a Publikování",aiContext:"Kontext pro AI",aiPlaceholder:"Příklad: focení na pláži při západu slunce, hravé a elegantní",generating:"Generování...",generateAi:"Generovat pomocí AI",aiHelp:"AI používá název videa, váš kontext a vybrané platformy k návrhu popisku a hashtagů.",captionPlaceholder:"Napište popisek...",generalCaptionHelp:"Použijte jeden obecný popisek nebo vygenerujte vlastní verzi pro každou vybranou platformu.",generatingPerPlatform:"Generování podle platformy...",generatePerPlatform:"Generovat podle platformy",customCaptionFor:"Vlastní popisek pro",publishNow:"Publikovat nyní",schedule:"Naplánovat",scheduledPublication:"Naplánovaná publikace",selectPlatforms:"Vybrat Platformy",chooseDestinations:"Vyberte cíle této publikace.",connected:"připojeno",noConnectedPlatforms:"Pro tohoto tvůrce nejsou připojeny žádné platformy.",connectedLabel:"Připojeno",publishingSummary:"Souhrn Publikování",noDestination:"Není vybrán žádný cíl.",destinationSelected:"cíl vybrán.",destinationsSelected:"cíle vybrány.",publishing:"Publikování...",chooseVideoTitle:"Vybrat video",pickMedia:"Vyberte média z knihovny tohoto tvůrce.",searchVideos:"Hledat videa...",allCategories:"Všechny kategorie",loadingPreviews:"Načítání náhledů videí...",noVideosFound:"Nebyla nalezena žádná videa",tryAnother:"Zkuste jiné hledání nebo kategorii.",ready:"Připraveno",of:"z",videos:"videí",close:"Zavřít",schedulePublication:"Naplánovat publikaci",scheduleHelp:"Vyberte, kdy má být váš obsah publikován.",today:"Dnes",tomorrow:"Zítra",nextWeek:"Příští týden",time:"Čas",quickTime:"Rychlý čas",publicationTime:"Čas publikace",cancel:"Zrušit",confirmSchedule:"Potvrdit plán",chooseDateTime:"Vyberte datum a čas",creatorFallback:"Tvůrce",queuedOther:"další publikace zůstávají ve frontě."}
};

const INSTAGRAM_FORMAT_COPY:
  Record<
    string,
    {
      title: string;
      help: string;
      post: string;
      postHelp: string;
      reel: string;
      reelHelp: string;
      story: string;
      storyHelp: string;
      postRequiresImage: string;
      reelRequiresVideo: string;
      scheduledFormatPending: string;
    }
  > = {
    "en-US": {
      title: "Instagram format",
      help: "Choose how this media will be published on Instagram.",
      post: "Post",
      postHelp: "Image in the Instagram feed",
      reel: "Reel",
      reelHelp: "Video published as a Reel",
      story: "Story",
      storyHelp: "Image or video published to Stories",
      postRequiresImage:
        "Instagram Post requires an image. Select an image or choose Reel/Story.",
      reelRequiresVideo:
        "Instagram Reel requires a video. Select a video or choose Post/Story.",
      scheduledFormatPending:
        "Scheduled Instagram Post and Story need the publish format saved with the publication. Use Publish now for Post/Story until that persistence step is completed.",
    },
    "pt-BR": {
      title: "Formato do Instagram",
      help: "Escolha como esta mídia será publicada no Instagram.",
      post: "Post",
      postHelp: "Imagem publicada no feed do Instagram",
      reel: "Reel",
      reelHelp: "Vídeo publicado como Reel",
      story: "Story",
      storyHelp: "Imagem ou vídeo publicado nos Stories",
      postRequiresImage:
        "O Post do Instagram exige uma imagem. Selecione uma imagem ou escolha Reel/Story.",
      reelRequiresVideo:
        "O Reel do Instagram exige um vídeo. Selecione um vídeo ou escolha Post/Story.",
      scheduledFormatPending:
        "Post e Story agendados ainda precisam salvar o formato junto da publicação. Por enquanto, use Publicar agora para Post/Story.",
    },
    "es-ES": {
      title: "Formato de Instagram",
      help: "Elige cómo se publicará este contenido en Instagram.",
      post: "Post",
      postHelp: "Imagen publicada en el feed de Instagram",
      reel: "Reel",
      reelHelp: "Video publicado como Reel",
      story: "Story",
      storyHelp: "Imagen o video publicado en Stories",
      postRequiresImage:
        "El Post de Instagram requiere una imagen. Selecciona una imagen o elige Reel/Story.",
      reelRequiresVideo:
        "El Reel de Instagram requiere un video. Selecciona un video o elige Post/Story.",
      scheduledFormatPending:
        "Los Post y Story programados todavía necesitan guardar el formato con la publicación. Por ahora usa Publicar ahora para Post/Story.",
    },
    "fr-FR": {
      title: "Format Instagram",
      help: "Choisissez comment ce média sera publié sur Instagram.",
      post: "Post",
      postHelp: "Image publiée dans le fil Instagram",
      reel: "Reel",
      reelHelp: "Vidéo publiée comme Reel",
      story: "Story",
      storyHelp: "Image ou vidéo publiée dans les Stories",
      postRequiresImage:
        "Le Post Instagram nécessite une image. Sélectionnez une image ou choisissez Reel/Story.",
      reelRequiresVideo:
        "Le Reel Instagram nécessite une vidéo. Sélectionnez une vidéo ou choisissez Post/Story.",
      scheduledFormatPending:
        "Les Post et Story programmés doivent encore enregistrer le format avec la publication. Utilisez Publier maintenant pour Post/Story pour le moment.",
    },
    "cs-CZ": {
      title: "Formát Instagramu",
      help: "Vyberte, jak bude toto médium publikováno na Instagramu.",
      post: "Post",
      postHelp: "Obrázek publikovaný ve feedu Instagramu",
      reel: "Reel",
      reelHelp: "Video publikované jako Reel",
      story: "Story",
      storyHelp: "Obrázek nebo video publikované do Stories",
      postRequiresImage:
        "Instagram Post vyžaduje obrázek. Vyberte obrázek nebo zvolte Reel/Story.",
      reelRequiresVideo:
        "Instagram Reel vyžaduje video. Vyberte video nebo zvolte Post/Story.",
      scheduledFormatPending:
        "Naplánovaný Instagram Post a Story ještě musí ukládat formát spolu s publikací. Prozatím použijte Publikovat nyní pro Post/Story.",
    },
  };

function getInstagramFormatCopy(
  locale: string,
) {
  return (
    INSTAGRAM_FORMAT_COPY[
      locale
    ] ??
    INSTAGRAM_FORMAT_COPY[
      "en-US"
    ]
  );
}

function getDistributionCopy(locale: string) {
  return DISTRIBUTION_COPY[locale] ?? DISTRIBUTION_COPY["en-US"];
}

const INSTAGRAM_ACCOUNT_COPY:
  Record<
    string,
    {
      accounts: string;
      allAccounts: string;
      selectAll: string;
      clear: string;
      selected: string;
      accountFallback: string;
      publishingTo: string;
      published: string;
      failed: string;
      waiting: string;
      retryFailedOnly: string;
    }
  > = {
    "en-US": {
      accounts: "Instagram accounts",
      allAccounts: "All accounts",
      selectAll: "Select all",
      clear: "Clear",
      selected: "selected",
      accountFallback: "Instagram account",
      publishingTo: "Publishing to",
      published: "Published",
      failed: "Failed",
      waiting: "Waiting",
      retryFailedOnly:
        "Only failed Instagram accounts remain selected, so you can retry without reposting to successful accounts.",
    },
    "pt-BR": {
      accounts: "Contas do Instagram",
      allAccounts: "Todas as contas",
      selectAll: "Selecionar todas",
      clear: "Limpar",
      selected: "selecionadas",
      accountFallback: "Conta do Instagram",
      publishingTo: "Publicando em",
      published: "Publicado",
      failed: "Falhou",
      waiting: "Aguardando",
      retryFailedOnly:
        "Somente as contas do Instagram que falharam continuam selecionadas, então você pode tentar novamente sem republicar nas contas que já deram certo.",
    },
    "es-ES": {
      accounts: "Cuentas de Instagram",
      allAccounts: "Todas las cuentas",
      selectAll: "Seleccionar todas",
      clear: "Limpiar",
      selected: "seleccionadas",
      accountFallback: "Cuenta de Instagram",
      publishingTo: "Publicando en",
      published: "Publicado",
      failed: "Falló",
      waiting: "En espera",
      retryFailedOnly:
        "Solo quedan seleccionadas las cuentas de Instagram que fallaron para que puedas reintentar sin volver a publicar en las cuentas correctas.",
    },
    "fr-FR": {
      accounts: "Comptes Instagram",
      allAccounts: "Tous les comptes",
      selectAll: "Tout sélectionner",
      clear: "Effacer",
      selected: "sélectionnés",
      accountFallback: "Compte Instagram",
      publishingTo: "Publication sur",
      published: "Publié",
      failed: "Échec",
      waiting: "En attente",
      retryFailedOnly:
        "Seuls les comptes Instagram en échec restent sélectionnés afin de pouvoir réessayer sans republier sur les comptes déjà réussis.",
    },
    "cs-CZ": {
      accounts: "Instagram účty",
      allAccounts: "Všechny účty",
      selectAll: "Vybrat vše",
      clear: "Vymazat",
      selected: "vybráno",
      accountFallback: "Instagram účet",
      publishingTo: "Publikuji na",
      published: "Publikováno",
      failed: "Selhalo",
      waiting: "Čeká",
      retryFailedOnly:
        "Vybrané zůstávají pouze neúspěšné Instagram účty, takže můžete opakovat bez znovupublikování na úspěšné účty.",
    },
  };

function getInstagramAccountCopy(
  locale: string,
) {
  return (
    INSTAGRAM_ACCOUNT_COPY[
      locale
    ] ??
    INSTAGRAM_ACCOUNT_COPY[
      "en-US"
    ]
  );
}

function getPlatformAccountDisplayName(
  account: PlatformAccount,
) {
  const customName =
    account.externalDisplayName?.trim() ||
    account.displayName?.trim();

  if (customName) {
    return customName;
  }

  const username =
    account.externalUsername?.trim();

  if (username) {
    return username.startsWith("@")
      ? username
      : `@${username}`;
  }

  return getPlatformLabel(
    account.platform,
  );
}

function getWeekDays(locale: string) {
  const base = new Date(Date.UTC(2026, 0, 4));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base);
    date.setUTCDate(base.getUTCDate() + index);
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date).replace(".", "");
  });
}

export default function DistributionPage() {
  const t = useTranslations("manyVids");
  const params = useParams<{ locale: string }>();
  const locale = params.locale || "en-US";
  const ui = getDistributionCopy(locale);
  const instagramUi =
    getInstagramFormatCopy(
      locale,
    );
  const instagramAccountUi =
    getInstagramAccountCopy(
      locale,
    );

  const [
    creators,
    setCreators,
  ] = useState<Creator[]>(
    [],
  );

  const [
    media,
    setMedia,
  ] = useState<
    MediaAsset[]
  >([]);

  const [
    performers,
    setPerformers,
  ] = useState<
    Performer[]
  >([]);

  const [
    selectedPerformerId,
    setSelectedPerformerId,
  ] = useState("");

  const [
    performerMedia,
    setPerformerMedia,
  ] = useState<
    MediaAsset[]
  >([]);

  const [
    performerFolders,
    setPerformerFolders,
  ] = useState<
    LibraryFolder[]
  >([]);

  const [
    selectedFolderId,
    setSelectedFolderId,
  ] = useState("ALL");

  const [
    isLoadingPerformerMedia,
    setIsLoadingPerformerMedia,
  ] = useState(false);

  const [
    platformAccounts,
    setPlatformAccounts,
  ] = useState<
    PlatformAccount[]
  >([]);

  const [
    selectedCreatorId,
    setSelectedCreatorId,
  ] = useState("");

  const [
    selectedMediaId,
    setSelectedMediaId,
  ] = useState("");

  const [
    selectedPlatformIds,
    setSelectedPlatformIds,
  ] = useState<string[]>(
    [],
  );

  const [
    instagramPublishType,
    setInstagramPublishType,
  ] = useState<InstagramPublishType>(
    "REEL",
  );

  const [
    caption,
    setCaption,
  ] = useState("");

  const [scheduleTimeZone, setScheduleTimeZone] = useState("UTC");
  const [scheduleError, setScheduleError] = useState("");
  const [manyVidsVideoMetadata, setManyVidsVideoMetadata] = useState<LocalOptions["assets"][number] | null>(null);
  const [manyVidsBlockReason, setManyVidsBlockReason] = useState("configureOptions");

  const [
    aiContext,
    setAiContext,
  ] = useState("");

  const [
    isGeneratingAi,
    setIsGeneratingAi,
  ] = useState(false);

  const [
    platformCaptions,
    setPlatformCaptions,
  ] = useState<
    Record<string, string>
  >({});

  const [
    isGeneratingPlatformAi,
    setIsGeneratingPlatformAi,
  ] = useState(false);

  const [
    publishMode,
    setPublishMode,
  ] = useState<
    "NOW" | "SCHEDULED"
  >("NOW");

  const [
    scheduledAt,
    setScheduledAt,
  ] = useState("");

  const [
    isScheduleOpen,
    setIsScheduleOpen,
  ] = useState(false);

  const [
    isThumbnailOpen,
    setIsThumbnailOpen,
  ] = useState(false);

  const thumbnailVideoRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const thumbnailFileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    aiThumbnailPrompt,
    setAiThumbnailPrompt,
  ] = useState("");

  const [
    isGeneratingThumbnailAi,
    setIsGeneratingThumbnailAi,
  ] = useState(false);

  const [
    thumbnailDuration,
    setThumbnailDuration,
  ] = useState(0);

  const [
    thumbnailTime,
    setThumbnailTime,
  ] = useState(0);

  const [
    thumbnailPreviewUrl,
    setThumbnailPreviewUrl,
  ] = useState("");

  const [
    isSavingThumbnail,
    setIsSavingThumbnail,
  ] = useState(false);

  const [
    scheduleDate,
    setScheduleDate,
  ] = useState(
    getDateInputValue(
      new Date(),
    ),
  );

  const [
    scheduleTime,
    setScheduleTime,
  ] = useState("15:00");

  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    ),
  );

  const [
    previewUrl,
    setPreviewUrl,
  ] = useState("");

  const [
    previewAspectRatio,
    setPreviewAspectRatio,
  ] = useState("16 / 9");

  const [
    isMediaPickerOpen,
    setIsMediaPickerOpen,
  ] = useState(false);

  const [
    mediaPickerSearch,
    setMediaPickerSearch,
  ] = useState("");


  const [
    mediaPickerCategoryId,
    setMediaPickerCategoryId,
  ] = useState("ALL");

  const [
    mediaCategories,
    setMediaCategories,
  ] = useState<
    MediaCategory[]
  >([]);

  const [
    mediaCategoryAssignments,
    setMediaCategoryAssignments,
  ] = useState<
    Record<
      string,
      MediaCategory[]
    >
  >({});

  const [
    mediaPickerPreviews,
    setMediaPickerPreviews,
  ] = useState<
    Record<string, string>
  >({});

  const [
    isLoadingMediaPicker,
    setIsLoadingMediaPicker,
  ] = useState(false);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    publicationProgress,
    setPublicationProgress,
  ] = useState(0);

  const [
    publicationProgressLabel,
    setPublicationProgressLabel,
  ] = useState("");

  const [
    showPublicationProgress,
    setShowPublicationProgress,
  ] = useState(false);

  const [
    instagramAccountProgress,
    setInstagramAccountProgress,
  ] = useState<
    Record<
      string,
      InstagramAccountProgress
    >
  >({});

  const [
    publicationHasFailures,
    setPublicationHasFailures,
  ] = useState(false);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    pageSuccess,
    setPageSuccess,
  ] = useState("");

  useEffect(() => {
    void loadOptions();
  }, []);

  async function loadOptions() {
    try {
      setIsLoading(true);
      setPageError("");

      const response =
        await fetch(
          "/api/distribution/options",
          {
            method: "GET",
            cache:
              "no-store",
          },
        );

      const data =
        (await response.json()) as OptionsResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            ui.loadOptionsError,
        );
      }

      const nextCreators =
        data.creators ??
        [];

      const nextMedia =
        data.media ??
        [];

      const nextMediaCategories =
        data.mediaCategories ??
        [];

      const nextAccounts =
        data.platformAccounts ??
        data.accounts ??
        [];

      setScheduleTimeZone(validTimeZone(data.timeZone));
      setCreators(
        nextCreators,
      );

      setMedia(
        nextMedia,
      );

      setMediaCategories(
        nextMediaCategories,
      );

      const nextAssignments:
        Record<
          string,
          MediaCategory[]
        > = {};

      for (
        const item of
        nextMedia
      ) {
        nextAssignments[
          item.id
        ] =
          item.categories ??
          [];
      }

      setMediaCategoryAssignments(
        nextAssignments,
      );

      setPlatformAccounts(
        nextAccounts,
      );

      const requestedMediaId =
        new URLSearchParams(
          window.location.search,
        )
          .get(
            "mediaId",
          )
          ?.trim();

      const requestedMedia =
        requestedMediaId
          ? nextMedia.find(
              (item) =>
                item.id ===
                requestedMediaId,
            )
          : null;

      if (
        requestedMedia
      ) {
        setSelectedCreatorId(
          requestedMedia.creatorId,
        );

        setSelectedMediaId(
          requestedMedia.id,
        );
      } else if (
        nextCreators.length >
        0
      ) {
        setSelectedCreatorId(
          nextCreators[0].id,
        );
      }

      try {
        const performersResponse =
          await fetch(
            "/api/performers",
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const performersData =
          (await performersResponse.json()) as PerformersResponse;

        if (
          !performersResponse.ok ||
          !performersData.success
        ) {
          throw new Error(
            performersData.message ||
              performersData.error ||
              ui.loadPerformersError,
          );
        }

        const nextPerformers =
          performersData.performers ??
          [];

        setPerformers(
          nextPerformers,
        );

        setSelectedPerformerId(
          (current) =>
            current ||
            nextPerformers[0]?.id ||
            "",
        );
      } catch (performerError) {
        console.error(
          "DISTRIBUTION_PERFORMERS_ERROR",
          performerError,
        );

        setPerformers(
          [],
        );
      }
    } catch (error) {
      console.error(
        "DISTRIBUTION_OPTIONS_ERROR",
        error,
      );

      setPageError(
        error instanceof Error
          ? error.message
          : ui.loadOptionsError,
      );
    } finally {
      setIsLoading(false);
    }
  }

  const folderLabelById =
    useMemo(() => {
      const byId =
        new Map(
          performerFolders.map(
            (folder) => [
              folder.id,
              folder,
            ],
          ),
        );

      const labels =
        new Map<
          string,
          string
        >();

      const buildLabel = (
        folder: LibraryFolder,
      ) => {
        const parts = [
          folder.name,
        ];

        let parentId =
          folder.parentId;

        const visited =
          new Set<string>();

        while (
          parentId &&
          !visited.has(
            parentId,
          )
        ) {
          visited.add(
            parentId,
          );

          const parent =
            byId.get(
              parentId,
            );

          if (!parent) {
            break;
          }

          parts.unshift(
            parent.name,
          );

          parentId =
            parent.parentId;
        }

        return parts.join(
          " / ",
        );
      };

      for (
        const folder of
        performerFolders
      ) {
        labels.set(
          folder.id,
          buildLabel(
            folder,
          ),
        );
      }

      return labels;
    }, [
      performerFolders,
    ]);

  const creatorMedia =
    useMemo(
      () =>
        performerMedia.filter(
          (item) =>
            item.creatorId ===
              selectedCreatorId &&
            (
              selectedFolderId ===
                "ALL" ||
              item.folderId ===
                selectedFolderId
            ),
        ),
      [
        performerMedia,
        selectedCreatorId,
        selectedFolderId,
      ],
    );

  useEffect(() => {
    if (
      !selectedPerformerId
    ) {
      setPerformerMedia(
        [],
      );

      setPerformerFolders(
        [],
      );

      setSelectedFolderId(
        "ALL",
      );

      return;
    }

    let cancelled =
      false;

    async function loadPerformerWorkspace() {
      try {
        setIsLoadingPerformerMedia(
          true,
        );

        setPageError(
          "",
        );

        const [
          mediaResponse,
          foldersResponse,
        ] =
          await Promise.all([
            fetch(
              `/api/media?performerId=${encodeURIComponent(
                selectedPerformerId,
              )}`,
              {
                method: "GET",
                cache: "no-store",
              },
            ),
            fetch(
              `/api/performer-library?performerId=${encodeURIComponent(
                selectedPerformerId,
              )}`,
              {
                method: "GET",
                cache: "no-store",
              },
            ),
          ]);

        const mediaData =
          (await mediaResponse.json()) as PerformerMediaResponse;

        const foldersData =
          (await foldersResponse.json()) as PerformerLibraryResponse;

        if (
          !mediaResponse.ok ||
          !mediaData.success
        ) {
          throw new Error(
            mediaData.error ||
              ui.loadPerformerMediaError,
          );
        }

        if (
          !foldersResponse.ok ||
          !foldersData.success
        ) {
          throw new Error(
            foldersData.error ||
              ui.loadFoldersError,
          );
        }

        if (cancelled) {
          return;
        }

        const nextPerformerMedia =
          mediaData.media ??
          [];

        setPerformerMedia(
          nextPerformerMedia,
        );

        setPerformerFolders(
          foldersData.folders ??
            [],
        );

        setSelectedFolderId(
          "ALL",
        );

        setMediaCategoryAssignments(
          (current) => {
            const next = {
              ...current,
            };

            for (
              const item of
              nextPerformerMedia
            ) {
              next[
                item.id
              ] =
                item.categories ??
                next[
                  item.id
                ] ??
                [];
            }

            return next;
          },
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "DISTRIBUTION_PERFORMER_MEDIA_ERROR",
          error,
        );

        setPerformerMedia(
          [],
        );

        setPerformerFolders(
          [],
        );

        setPageError(
          error instanceof Error
            ? error.message
            : ui.loadPerformerMediaError,
        );
      } finally {
        if (!cancelled) {
          setIsLoadingPerformerMedia(
            false,
          );
        }
      }
    }

    void loadPerformerWorkspace();

    return () => {
      cancelled =
        true;
    };
  }, [
    selectedPerformerId,
    ui.loadFoldersError,
    ui.loadPerformerMediaError,
  ]);

  const creatorAccounts =
    useMemo(() => {
      const items =
        platformAccounts.filter(
          (account) =>
            account.creatorId ===
              selectedCreatorId &&
            account.status ===
              "CONNECTED",
        );

      return [...items].sort(
        (a, b) => {
          const indexA =
            PLATFORM_ORDER.indexOf(
              a.platform,
            );

          const indexB =
            PLATFORM_ORDER.indexOf(
              b.platform,
            );

          const safeA =
            indexA === -1
              ? 999
              : indexA;

          const safeB =
            indexB === -1
              ? 999
              : indexB;

          return (
            safeA - safeB
          );
        },
      );
    }, [
      platformAccounts,
      selectedCreatorId,
    ]);

  const instagramAccounts =
    useMemo(
      () =>
        creatorAccounts.filter(
          (account) =>
            account.platform ===
            "INSTAGRAM",
        ),
      [creatorAccounts],
    );

  const selectedInstagramAccounts =
    useMemo(
      () =>
        instagramAccounts.filter(
          (account) =>
            selectedPlatformIds.includes(
              account.id,
            ),
        ),
      [
        instagramAccounts,
        selectedPlatformIds,
      ],
    );

  const instagramSelected =
    selectedInstagramAccounts.length >
    0;

  const allInstagramSelected =
    instagramAccounts.length >
      0 &&
    selectedInstagramAccounts.length ===
      instagramAccounts.length;

  const manyVidsAccount = useMemo(
    () => creatorAccounts.find((account) => account.platform === "MANYVIDS" && selectedPlatformIds.includes(account.id))
      ?? creatorAccounts.find((account) => account.platform === "MANYVIDS") ?? null,
    [creatorAccounts, selectedPlatformIds],
  );

  const manyVidsSelected =
    Boolean(
      manyVidsAccount &&
        selectedPlatformIds.includes(
          manyVidsAccount.id,
        ),
    );

  const selectedLocalPerformer =
    useMemo(
      () =>
        performers.find(
          (performer) =>
            performer.id ===
            selectedPerformerId,
        ) ?? null,
      [
        performers,
        selectedPerformerId,
      ],
    );

  const selectedMedia =
    useMemo(
      () =>
        creatorMedia.find(
          (item) =>
            item.id ===
            selectedMediaId,
        ) ?? null,
      [
        creatorMedia,
        selectedMediaId,
      ],
    );

  const filteredPickerMedia =
    useMemo(() => {
      const query =
        mediaPickerSearch
          .trim()
          .toLowerCase();

      return creatorMedia.filter(
        (item) => {
          if (
            mediaPickerCategoryId !==
              "ALL" &&
            !(
              mediaCategoryAssignments[
                item.id
              ] ??
              []
            ).some(
              (category) =>
                category.id ===
                mediaPickerCategoryId,
            )
          ) {
            return false;
          }

          if (
            query &&
            !item.originalFileName
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
      creatorMedia,
      mediaCategoryAssignments,
      mediaPickerCategoryId,
      mediaPickerSearch,
    ]);

  const { manyVidsTitle, setManyVidsTitle, manyVidsDescription, setManyVidsDescription, manyVidsPrice, setManyVidsPrice, manyVidsTags, setManyVidsTags, manyVidsOptions, setManyVidsOptions } = useManyVidsDraft(
    `${selectedCreatorId}:${selectedMediaId}`,
    selectedMedia?.originalFileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || t("newVideo"),
    caption.trim(),
  );
  const manyVidsMetadataValid = publishInputSchema.safeParse({
    publicationId: "pending", title: manyVidsTitle.trim(), description: manyVidsDescription,
    price: Number(manyVidsPrice.replace(",", ".")), tags: manyVidsTags,
    performers: manyVidsOptions.performers, thumbnail: manyVidsOptions.thumbnail, teaser: manyVidsOptions.teaser, publishMode,
  }).success;
  const selectedMediaMissingManyVidsFields = selectedMedia?.mediaType === "VIDEO"
    ? missingVideoMetadataFields(selectedMedia)
    : [];
  const refreshedMediaMissingManyVidsFields = selectedMedia?.mediaType === "VIDEO" && manyVidsVideoMetadata?.id === selectedMedia.id
    ? missingVideoMetadataFields(manyVidsVideoMetadata)
    : null;
  const missingManyVidsVideoFields = refreshedMediaMissingManyVidsFields && refreshedMediaMissingManyVidsFields.length < selectedMediaMissingManyVidsFields.length
    ? refreshedMediaMissingManyVidsFields
    : selectedMediaMissingManyVidsFields;
  const manyVidsPublishBlockReason = missingManyVidsVideoFields.length
    ? t("olderVideoNeedsMetadata")
    : (manyVidsBlockReason ? t(manyVidsBlockReason) : "") || (!manyVidsMetadataValid ? t("completeMetadata") : "");

  useEffect(() => {
    setSelectedMediaId(
      "",
    );

    setSelectedPlatformIds(
      [],
    );

    setInstagramPublishType(
      "REEL",
    );

    setPlatformCaptions(
      {},
    );

    setMediaPickerSearch(
      "",
    );

    setMediaPickerCategoryId(
      "ALL",
    );

    setMediaPickerPreviews(
      {},
    );

    setIsMediaPickerOpen(
      false,
    );

    setIsThumbnailOpen(
      false,
    );

    setThumbnailDuration(
      0,
    );
    setThumbnailTime(
      0,
    );
    setThumbnailPreviewUrl(
      "",
    );

    setPreviewUrl("");
  }, [
    selectedCreatorId,
  ]);


  useEffect(() => {
    setSelectedMediaId(
      "",
    );

    setMediaPickerSearch(
      "",
    );

    setMediaPickerCategoryId(
      "ALL",
    );

    setMediaPickerPreviews(
      {},
    );

    setIsMediaPickerOpen(
      false,
    );

    setIsThumbnailOpen(
      false,
    );

    setPreviewUrl(
      "",
    );
  }, [
    selectedPerformerId,
    selectedFolderId,
  ]);

  useEffect(() => {
    setManyVidsVideoMetadata(null);
    setManyVidsBlockReason("configureOptions");
    setThumbnailDuration(
      0,
    );
    setThumbnailTime(
      0,
    );
    setThumbnailPreviewUrl(
      "",
    );
    setAiThumbnailPrompt(
      "",
    );
    setPreviewAspectRatio(
      "16 / 9",
    );

    if (!selectedMediaId) {
      setPreviewUrl("");
      return;
    }

    void loadPreview(
      selectedMediaId,
    );
  }, [
    selectedMediaId,
  ]);

  useEffect(() => {
    if (!selectedMedia) {
      return;
    }

    const selectedMediaType =
      selectedMedia.mediaType
        ?.trim()
        .toUpperCase();

    setInstagramPublishType(
      (current) => {
        if (
          current ===
            "STORY"
        ) {
          return current;
        }

        if (
          selectedMediaType ===
          "IMAGE"
        ) {
          return "POST";
        }

        return "REEL";
      },
    );
  }, [
    selectedMedia,
  ]);



  async function loadPreview(
    mediaId: string,
  ) {
    try {
      const response =
        await fetch(
          `/api/media/${mediaId}/preview`,
          {
            method: "GET",
            cache:
              "no-store",
          },
        );

      const data =
        (await response.json()) as PreviewResponse;

      if (
        response.ok &&
        data.success &&
        data.previewUrl
      ) {
        setPreviewUrl(
          data.previewUrl,
        );
      }
    } catch {
      setPreviewUrl("");
    }
  }

  async function openMediaPicker() {
    setIsMediaPickerOpen(
      true,
    );

    if (
      creatorMedia.length ===
      0
    ) {
      return;
    }

    try {
      setIsLoadingMediaPicker(
        true,
      );

      const missingItems =
        creatorMedia.filter(
          (item) =>
            !mediaPickerPreviews[
              item.id
            ],
        );

      if (
        missingItems.length ===
        0
      ) {
        return;
      }

      const entries =
        await Promise.all(
          missingItems.map(
            async (item) => {
              try {
                const response =
                  await fetch(
                    `/api/media/${item.id}/preview`,
                    {
                      method:
                        "GET",
                      cache:
                        "no-store",
                    },
                  );

                const data =
                  (await response.json()) as PreviewResponse;

                if (
                  !response.ok ||
                  !data.success ||
                  !data.previewUrl
                ) {
                  return null;
                }

                return [
                  item.id,
                  data.previewUrl,
                ] as const;
              } catch {
                return null;
              }
            },
          ),
        );

      setMediaPickerPreviews(
        (current) => {
          const next = {
            ...current,
          };

          for (
            const entry of
            entries
          ) {
            if (!entry) {
              continue;
            }

            next[
              entry[0]
            ] = entry[1];
          }

          return next;
        },
      );
    } finally {
      setIsLoadingMediaPicker(
        false,
      );
    }
  }

  function selectMediaFromPicker(
    mediaId: string,
  ) {
    setSelectedMediaId(
      mediaId,
    );

    setIsMediaPickerOpen(
      false,
    );

    setMediaPickerSearch(
      "",
    );

    setMediaPickerCategoryId(
      "ALL",
    );
  }

  function togglePlatform(
    accountId: string,
  ) {
    setSelectedPlatformIds(
      (current) => {
        const isSelected =
          current.includes(
            accountId,
          );

        if (isSelected) {
          setPlatformCaptions(
            (captions) => {
              const next = {
                ...captions,
              };

              delete next[
                accountId
              ];

              return next;
            },
          );

          return current.filter(
            (id) =>
              id !==
              accountId,
          );
        }

        return [
          ...current,
          accountId,
        ];
      },
    );
  }

  function toggleAllInstagram() {
    const instagramIds =
      instagramAccounts.map(
        (account) =>
          account.id,
      );

    if (
      instagramIds.length ===
      0
    ) {
      return;
    }

    if (allInstagramSelected) {
      setSelectedPlatformIds(
        (current) =>
          current.filter(
            (id) =>
              !instagramIds.includes(
                id,
              ),
          ),
      );

      setPlatformCaptions(
        (captions) => {
          const next = {
            ...captions,
          };

          for (
            const id of
            instagramIds
          ) {
            delete next[id];
          }

          return next;
        },
      );

      return;
    }

    setSelectedPlatformIds(
      (current) => {
        const next =
          new Set(
            current,
          );

        for (
          const id of
          instagramIds
        ) {
          next.add(
            id,
          );
        }

        return Array.from(
          next,
        );
      },
    );
  }

  function openSchedule() {
    setScheduleError("");
    setPublishMode(
      "SCHEDULED",
    );

    if (scheduledAt) {
      const [
        dateValue,
        timeValue,
      ] =
        scheduledAt.split(
          "T",
        );

      if (dateValue) {
        setScheduleDate(
          dateValue,
        );

        const date =
          new Date(
            `${dateValue}T12:00:00`,
          );

        setCalendarMonth(
          new Date(
            date.getFullYear(),
            date.getMonth(),
            1,
          ),
        );
      }

      if (timeValue) {
        setScheduleTime(
          timeValue,
        );
      }
    }

    if (!scheduledAt && manyVidsSelected) {
      const day = wallTime(new Date(), scheduleTimeZone).slice(0, 10);
      setScheduleDate(day);
      const calendar = new Date(`${day}T12:00:00`);
      setCalendarMonth(new Date(calendar.getFullYear(), calendar.getMonth(), 1));
    }
    setIsScheduleOpen(
      true,
    );
  }

  function selectCalendarDate(
    date: Date,
  ) {
    setScheduleDate(
      getDateInputValue(
        date,
      ),
    );
  }

  function selectQuickDate(
    daysAhead: number,
  ) {
    const date = new Date(`${wallTime(new Date(), manyVidsSelected ? scheduleTimeZone : Intl.DateTimeFormat().resolvedOptions().timeZone).slice(0,10)}T12:00:00`);

    date.setDate(
      date.getDate() +
        daysAhead,
    );

    setScheduleDate(
      getDateInputValue(
        date,
      ),
    );

    setCalendarMonth(
      new Date(
        date.getFullYear(),
        date.getMonth(),
        1,
      ),
    );
  }

  function confirmSchedule() {
    if (
      !scheduleDate ||
      !scheduleTime
    ) {
      return;
    }

    if (manyVidsSelected) {
      try { scheduledUtc(`${scheduleDate}T${scheduleTime}`, scheduleTimeZone); }
      catch (error) { const code = error instanceof Error ? error.message : "SCHEDULE_INVALID"; setScheduleError(t(`errors.${code}`)); return; }
    }
    setScheduledAt(
      `${scheduleDate}T${scheduleTime}`,
    );

    setPublishMode(
      "SCHEDULED",
    );

    setIsScheduleOpen(
      false,
    );
  }

  async function generateAiCaption() {
    setPageError("");
    setPageSuccess("");

    if (!selectedMedia) {
      setPageError(
        ui.selectVideoBeforeAi,
      );
      return;
    }

    try {
      setIsGeneratingAi(
        true,
      );

      const selectedPlatforms =
        creatorAccounts
          .filter(
            (account) =>
              selectedPlatformIds.includes(
                account.id,
              ),
          )
          .map(
            (account) =>
              getPlatformLabel(
                account.platform,
              ),
          );

      const response =
        await fetch(
          "/api/ai/caption",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              fileName:
                selectedMedia.originalFileName,
              context:
                aiContext.trim(),
              platforms:
                selectedPlatforms,
              language:
                locale,
            }),
          },
        );

      const data =
        (await response.json()) as AiCaptionResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.caption
      ) {
        throw new Error(
          data.error ||
            ui.generateCaptionError,
        );
      }

      const hashtags =
        Array.isArray(
          data.hashtags,
        )
          ? data.hashtags
          : [];

      const combined =
        [
          data.caption.trim(),
          hashtags.length > 0
            ? hashtags.join(" ")
            : "",
        ]
          .filter(Boolean)
          .join("\n\n")
          .slice(
            0,
            2200,
          );

      setCaption(
        combined,
      );



      setPageSuccess(
        ui.aiCaptionSuccess,
      );
    } catch (error) {
      console.error(
        "AI_CAPTION_GENERATION_ERROR",
        error,
      );

      setPageError(
        error instanceof Error
          ? error.message
          : ui.generateCaptionError,
      );
    } finally {
      setIsGeneratingAi(
        false,
      );
    }
  }

  async function generatePlatformCaptions() {
    setPageError("");
    setPageSuccess("");

    if (!selectedMedia) {
      setPageError(
        ui.selectVideoBeforeAi,
      );
      return;
    }

    const selectedAccounts =
      creatorAccounts.filter(
        (account) =>
          selectedPlatformIds.includes(
            account.id,
          ),
      );

    if (
      selectedAccounts.length ===
      0
    ) {
      setPageError(
        ui.selectPlatformBeforeAi,
      );
      return;
    }

    try {
      setIsGeneratingPlatformAi(
        true,
      );

      const response =
        await fetch(
          "/api/ai/platform-captions",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              fileName:
                selectedMedia.originalFileName,
              context:
                aiContext.trim(),
              language:
                locale,
              platforms:
                selectedAccounts.map(
                  (account) => ({
                    platformAccountId:
                      account.id,
                    platform:
                      account.platform,
                    label:
                      getPlatformLabel(
                        account.platform,
                      ),
                  }),
                ),
            }),
          },
        );

      const data =
        (await response.json()) as AiPlatformCaptionsResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.captions
      ) {
        throw new Error(
          data.error ||
            ui.generatePlatformCaptionsError,
        );
      }

      const nextCaptions:
        Record<
          string,
          string
        > = {};

      for (
        const item of
        data.captions
      ) {
        const itemHashtags =
          Array.isArray(
            item.hashtags,
          )
            ? item.hashtags
            : [];

        const combined =
          [
            item.caption.trim(),
            itemHashtags.length >
            0
              ? itemHashtags.join(
                  " ",
                )
              : "",
          ]
            .filter(Boolean)
            .join("\n\n")
            .slice(
              0,
              2200,
            );

        nextCaptions[
          item.platformAccountId
        ] = combined;


      }

      setPlatformCaptions(
        nextCaptions,
      );

      setPageSuccess(
        ui.platformCaptionsSuccess,
      );
    } catch (error) {
      console.error(
        "AI_PLATFORM_CAPTIONS_ERROR",
        error,
      );

      setPageError(
        error instanceof Error
          ? error.message
          : ui.generatePlatformCaptionsError,
      );
    } finally {
      setIsGeneratingPlatformAi(
        false,
      );
    }
  }

  function seekThumbnailVideo(
    value: number,
  ) {
    const video =
      thumbnailVideoRef.current;

    if (!video) {
      return;
    }

    const safeValue =
      Math.max(
        0,
        Math.min(
          value,
          Number.isFinite(
            video.duration,
          )
            ? video.duration
            : value,
        ),
      );

    video.currentTime =
      safeValue;

    setThumbnailTime(
      safeValue,
    );
  }

  async function saveThumbnailBlob(
    blob: Blob,
    successMessage: string,
  ) {
    if (!selectedMediaId) {
      throw new Error(
        "Select media before saving a thumbnail.",
      );
    }

    const response =
      await fetch(
        `/api/media/${selectedMediaId}/thumbnail`,
        {
          method:
            "POST",
          headers: {
            "Content-Type":
              blob.type ||
              "image/jpeg",
            "X-Thumbnail-File-Name":
              `thumbnail-${selectedMediaId}.jpg`,
          },
          body:
            blob,
        },
      );

    const responseText =
      await response.text();

    let data:
      ThumbnailSaveResponse;

    try {
      data =
        JSON.parse(
          responseText,
        ) as ThumbnailSaveResponse;
    } catch {
      throw new Error(
        responseText ||
          `Thumbnail save failed with HTTP ${response.status}.`,
      );
    }

    if (
      !response.ok ||
      !data.success ||
      !data.thumbnailUrl
    ) {
      throw new Error(
        data.message ||
          data.error ||
          "Unable to save thumbnail.",
      );
    }

    setThumbnailPreviewUrl(
      data.thumbnailUrl,
    );

    setPageSuccess(
      successMessage,
    );

    return data;
  }

  async function cropImageToThumbnail(
    source: Blob,
  ) {
    const sourceUrl =
      URL.createObjectURL(
        source,
      );

    try {
      const image =
        await new Promise<HTMLImageElement>(
          (
            resolve,
            reject,
          ) => {
            const element =
              new Image();

            element.onload =
              () =>
                resolve(
                  element,
                );

            element.onerror =
              () =>
                reject(
                  new Error(
                    "THUMBNAIL_IMAGE_LOAD_FAILED",
                  ),
                );

            element.src =
              sourceUrl;
          },
        );

      const outputWidth =
        1080;

      const outputHeight =
        instagramPublishType ===
        "POST"
          ? 1080
          : 1920;

      const targetRatio =
        outputWidth /
        outputHeight;

      const sourceWidth =
        image.naturalWidth;

      const sourceHeight =
        image.naturalHeight;

      const sourceRatio =
        sourceWidth /
        sourceHeight;

      let cropX = 0;
      let cropY = 0;
      let cropWidth =
        sourceWidth;
      let cropHeight =
        sourceHeight;

      if (
        sourceRatio >
        targetRatio
      ) {
        cropWidth =
          sourceHeight *
          targetRatio;
        cropX =
          (sourceWidth -
            cropWidth) /
          2;
      } else if (
        sourceRatio <
        targetRatio
      ) {
        cropHeight =
          sourceWidth /
          targetRatio;
        cropY =
          (sourceHeight -
            cropHeight) /
          2;
      }

      const canvas =
        document.createElement(
          "canvas",
        );

      canvas.width =
        outputWidth;
      canvas.height =
        outputHeight;

      const context =
        canvas.getContext(
          "2d",
        );

      if (!context) {
        throw new Error(
          "THUMBNAIL_CANVAS_CONTEXT_FAILED",
        );
      }

      context.drawImage(
        image,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        outputWidth,
        outputHeight,
      );

      return await new Promise<Blob>(
        (
          resolve,
          reject,
        ) => {
          canvas.toBlob(
            (result) => {
              if (result) {
                resolve(
                  result,
                );
              } else {
                reject(
                  new Error(
                    "THUMBNAIL_EXPORT_FAILED",
                  ),
                );
              }
            },
            "image/jpeg",
            0.92,
          );
        },
      );
    } finally {
      URL.revokeObjectURL(
        sourceUrl,
      );
    }
  }

  async function handleThumbnailFile(
    file:
      | File
      | null,
  ) {
    if (!file) {
      return;
    }

    setPageError("");
    setPageSuccess("");

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(
        file.type,
      )
    ) {
      setPageError(
        "Choose a JPEG, PNG or WEBP image.",
      );
      return;
    }

    try {
      setIsSavingThumbnail(
        true,
      );

      const cropped =
        await cropImageToThumbnail(
          file,
        );

      await saveThumbnailBlob(
        cropped,
        instagramPublishType ===
          "REEL"
          ? "Custom thumbnail saved. It will be used as the Reel cover."
          : "Custom thumbnail saved successfully.",
      );
    } catch (error) {
      console.error(
        "THUMBNAIL_FILE_SAVE_ERROR",
        error,
      );

      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to save custom thumbnail.",
      );
    } finally {
      setIsSavingThumbnail(
        false,
      );

      if (
        thumbnailFileInputRef.current
      ) {
        thumbnailFileInputRef.current.value =
          "";
      }
    }
  }

  async function generateAiThumbnail() {
    setPageError("");
    setPageSuccess("");

    if (
      !selectedMediaId ||
      !selectedMedia
    ) {
      setPageError(
        "Select media before generating a thumbnail.",
      );
      return;
    }

    try {
      setIsGeneratingThumbnailAi(
        true,
      );

      const response =
        await fetch(
          `/api/media/${selectedMediaId}/thumbnail/ai`,
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                prompt:
                  aiThumbnailPrompt.trim(),
                publishType:
                  instagramPublishType,
                fileName:
                  selectedMedia.originalFileName,
                caption:
                  caption.trim(),
              }),
          },
        );

      const responseText =
        await response.text();

      let data:
        AiThumbnailResponse;

      try {
        data =
          JSON.parse(
            responseText,
          ) as AiThumbnailResponse;
      } catch {
        throw new Error(
          responseText ||
            `AI thumbnail generation failed with HTTP ${response.status}.`,
        );
      }

      if (
        !response.ok ||
        !data.success ||
        !data.thumbnailUrl
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to generate AI thumbnail.",
        );
      }

      setThumbnailPreviewUrl(
        data.thumbnailUrl,
      );

      setPageSuccess(
        instagramPublishType ===
          "REEL"
          ? "AI thumbnail generated and saved. It will be used as the Reel cover."
          : "AI thumbnail generated and saved.",
      );
    } catch (error) {
      console.error(
        "AI_THUMBNAIL_GENERATION_ERROR",
        error,
      );

      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to generate AI thumbnail.",
      );
    } finally {
      setIsGeneratingThumbnailAi(
        false,
      );
    }
  }

  async function saveCurrentFrameAsThumbnail() {
    setPageError("");
    setPageSuccess("");

    if (
      !selectedMedia ||
      !selectedMediaId
    ) {
      setPageError(
        "Select media before creating a thumbnail.",
      );
      return;
    }

    if (
      selectedMedia.mediaType
        ?.trim()
        .toUpperCase() !==
      "VIDEO"
    ) {
      setPageError(
        "Frame extraction is available for video media.",
      );
      return;
    }

    const video =
      thumbnailVideoRef.current;

    if (
      !video ||
      video.readyState <
        2 ||
      video.videoWidth <
        1 ||
      video.videoHeight <
        1
    ) {
      setPageError(
        "The video frame is not ready yet. Wait for the preview and try again.",
      );
      return;
    }

    try {
      setIsSavingThumbnail(
        true,
      );

      video.pause();

      const outputWidth =
        1080;

      const outputHeight =
        instagramPublishType ===
        "POST"
          ? 1080
          : 1920;

      const targetRatio =
        outputWidth /
        outputHeight;

      const sourceWidth =
        video.videoWidth;
      const sourceHeight =
        video.videoHeight;

      const sourceRatio =
        sourceWidth /
        sourceHeight;

      let cropX = 0;
      let cropY = 0;
      let cropWidth =
        sourceWidth;
      let cropHeight =
        sourceHeight;

      if (
        sourceRatio >
        targetRatio
      ) {
        cropWidth =
          sourceHeight *
          targetRatio;
        cropX =
          (sourceWidth -
            cropWidth) /
          2;
      } else if (
        sourceRatio <
        targetRatio
      ) {
        cropHeight =
          sourceWidth /
          targetRatio;
        cropY =
          (sourceHeight -
            cropHeight) /
          2;
      }

      const canvas =
        document.createElement(
          "canvas",
        );

      canvas.width =
        outputWidth;
      canvas.height =
        outputHeight;

      const context =
        canvas.getContext(
          "2d",
        );

      if (!context) {
        throw new Error(
          "THUMBNAIL_CANVAS_CONTEXT_FAILED",
        );
      }

      context.drawImage(
        video,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        outputWidth,
        outputHeight,
      );

      const blob =
        await new Promise<Blob>(
          (
            resolve,
            reject,
          ) => {
            canvas.toBlob(
              (result) => {
                if (result) {
                  resolve(
                    result,
                  );
                } else {
                  reject(
                    new Error(
                      "THUMBNAIL_EXPORT_FAILED",
                    ),
                  );
                }
              },
              "image/jpeg",
              0.92,
            );
          },
        );

      await saveThumbnailBlob(
        blob,
        instagramPublishType ===
          "REEL"
          ? "Thumbnail saved. This image will be used as the Reel cover."
          : "Thumbnail saved successfully.",
      );
    } catch (error) {
      console.error(
        "THUMBNAIL_FRAME_SAVE_ERROR",
        error,
      );

      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to create thumbnail.",
      );
    } finally {
      setIsSavingThumbnail(
        false,
      );
    }
  }

  function resetPublicationForm() {
    setSelectedMediaId(
      "",
    );
    setPreviewUrl(
      "",
    );
    setSelectedPlatformIds(
      [],
    );
    setInstagramAccountProgress(
      {},
    );
    setPublicationHasFailures(
      false,
    );
    setCaption(
      "",
    );
    setPlatformCaptions(
      {},
    );
    setAiContext(
      "",
    );

    setPublishMode(
      "NOW",
    );
    setScheduledAt(
      "",
    );
    setScheduleDate(
      getDateInputValue(
        new Date(),
      ),
    );
    setScheduleTime(
      "15:00",
    );
    setIsScheduleOpen(
      false,
    );

    setInstagramPublishType(
      "REEL",
    );

    setThumbnailDuration(
      0,
    );
    setThumbnailTime(
      0,
    );
    setThumbnailPreviewUrl(
      "",
    );
    setIsThumbnailOpen(
      false,
    );

    setManyVidsTitle(
      "",
    );
    setManyVidsDescription(
      "",
    );
    setManyVidsPrice(
      "",
    );
    setManyVidsTags([]);
    setManyVidsOptions(emptyManyVidsOptions());

  }

  async function completePublicationAndReset(
    message: string,
  ) {
    setPublicationProgress(
      100,
    );
    setPublicationProgressLabel(
      message,
    );
    setPageSuccess(
      "",
    );

    await new Promise<void>(
      (resolve) => {
        window.setTimeout(
          resolve,
          3000,
        );
      },
    );

    resetPublicationForm();

    setPublicationProgress(
      0,
    );
    setPublicationProgressLabel(
      "",
    );
    setShowPublicationProgress(
      false,
    );
  }

  async function submitDistribution() {
    setPageError("");
    setPageSuccess("");

    if (manyVidsSelected) {
      if (publishMode === "SCHEDULED" && selectedPlatformIds.length !== 1) { setPageError(t("errors.SCHEDULE_MANYVIDS_ONLY")); return; }
      if (manyVidsPublishBlockReason) {
        setPageError(manyVidsPublishBlockReason);
        return;
      }
      const checked = publishInputSchema.safeParse({
        publicationId: "pending", title: manyVidsTitle.trim(), description: manyVidsDescription,
        price: Number(manyVidsPrice.replace(",", ".")), tags: manyVidsTags,
        performers: manyVidsOptions.performers, thumbnail: manyVidsOptions.thumbnail, teaser: manyVidsOptions.teaser, publishMode,
      });
      if (!checked.success || (!manyVidsOptions.performers.length && !manyVidsOptions.confirmedNoPerformers)) {
        setPageError(t("completeForm"));
        return;
      }
      if (creatorAccounts.filter((account) => account.platform === "MANYVIDS" && selectedPlatformIds.includes(account.id)).length !== 1) {
        setPageError(t("oneAccount"));
        return;
      }
      const normalizedPrice =
        Number(
          manyVidsPrice.replace(
            ",",
            ".",
          ),
        );

      if (
        !manyVidsTitle.trim()
      ) {
        setPageError(
          t("titleRequired"),
        );
        return;
      }

      if (
        !Number.isFinite(
          normalizedPrice,
        ) ||
        normalizedPrice <= 0
      ) {
        setPageError(
          t("priceRequired"),
        );
        return;
      }

      const normalizedTags = manyVidsTags;

      if (
        normalizedTags.length <
        3
      ) {
        setPageError(
          t("tagsRequired"),
        );
        return;
      }

    }

    if (
      !selectedCreatorId
    ) {
      setPageError(
        ui.selectCreator,
      );

      return;
    }

    if (!selectedMediaId) {
      setPageError(
        ui.selectVideo,
      );

      return;
    }

    if (
      selectedPlatformIds.length ===
      0
    ) {
      setPageError(
        ui.selectPlatform,
      );

      return;
    }

    if (
      instagramSelected &&
      selectedMedia
    ) {
      const selectedMediaType =
        selectedMedia.mediaType
          ?.trim()
          .toUpperCase();

      if (
        instagramPublishType ===
          "POST" &&
        selectedMediaType !==
          "IMAGE"
      ) {
        setPageError(
          instagramUi.postRequiresImage,
        );

        return;
      }

      if (
        instagramPublishType ===
          "REEL" &&
        selectedMediaType ===
          "IMAGE"
      ) {
        setPageError(
          instagramUi.reelRequiresVideo,
        );

        return;
      }

      if (
        publishMode ===
          "SCHEDULED" &&
        instagramPublishType !==
          "REEL"
      ) {
        setPageError(
          instagramUi.scheduledFormatPending,
        );

        return;
      }
    }

    if (
      publishMode ===
        "SCHEDULED" &&
      !scheduledAt
    ) {
      setPageError(
        ui.choosePublishingDateTime,
      );

      openSchedule();

      return;
    }

    try {
      setIsSubmitting(
        true,
      );

      setShowPublicationProgress(
        true,
      );
      setInstagramAccountProgress(
        {},
      );
      setPublicationHasFailures(
        false,
      );
      setPublicationProgress(
        8,
      );
      setPublicationProgressLabel(
        publishMode ===
          "SCHEDULED"
          ? (manyVidsSelected ? t("preparingSchedule") : "Preparing schedule...")
          : "Preparing publication...",
      );

      const scheduleInstant = publishMode === "SCHEDULED" ? (manyVidsSelected ? scheduledUtc(scheduledAt, scheduleTimeZone) : new Date(scheduledAt).toISOString()) : null;
      const response =
        await fetch(
          "/api/distribution",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                mediaAssetId:
                  selectedMediaId,
                platformAccountIds:
                  selectedPlatformIds,
                caption:
                  caption.trim(),
                captionsByPlatformAccountId:
                  platformCaptions,
                publishMode,
                scheduledAt: scheduleInstant,
                ...(manyVidsSelected && publishMode === "SCHEDULED" ? {manyVidsOptions: {
                  title:manyVidsTitle.trim(), description:(manyVidsDescription.trim() || caption.trim()).slice(0,5000),
                  price:Number(manyVidsPrice.replace(",", ".")), tags:manyVidsTags, performers:manyVidsOptions.performers,
                  thumbnail:manyVidsOptions.thumbnail,teaser:manyVidsOptions.teaser
                }} : {}),
              }),
          },
        );

      const data =
        (await response.json()) as DistributionResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          manyVidsSelected
            ? (t.has(`errors.${data.error}`) ? t(`errors.${data.error}`) : ui.createDistributionError)
            : data.error || ui.createDistributionError,
        );
      }

      setPublicationProgress(
        22,
      );
      setPublicationProgressLabel(
        publishMode ===
          "SCHEDULED"
          ? (manyVidsSelected ? t("scheduleSaved", {timeZone:scheduleTimeZone}) : "Schedule created. Preparing destinations...")
          : "Publication created. Preparing destinations...",
      );

      if (manyVidsSelected && publishMode === "SCHEDULED") {
        await completePublicationAndReset(t("scheduleSaved", {timeZone:scheduleTimeZone}));
        return;
      }
      const publications =
        data.publications ?? [];

      const manyVidsPublications =
        publications.filter(
          (publication) =>
            publication.platform ===
            "MANYVIDS",
        );

      let manyVidsStaged =
        false;
      let manyVidsFailure = "";

      if (
        manyVidsPublications.length >
        0
      ) {
        setPublicationProgress(
          32,
        );
        setPublicationProgressLabel(
          t("preparing"),
        );


        try {
          const manyVidsResponse = await fetch("/api/distribution/execute/manyvids", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              publicationId: manyVidsPublications[0].id,
              title: manyVidsTitle.trim(),
              description: (manyVidsDescription.trim() || caption.trim()).slice(0, 5000),
              price: Number(manyVidsPrice.replace(",", ".")),
              tags: manyVidsTags,
              performers: manyVidsOptions.performers,
              thumbnail: manyVidsOptions.thumbnail,
              teaser: manyVidsOptions.teaser,
              publishMode, scheduleDate, scheduleTime,
            }),
          });
          const manyVidsData = await manyVidsResponse.json().catch(() => null) as ExecuteManyVidsResponse | null;
          if (!manyVidsResponse.ok || !manyVidsData?.success || manyVidsData.status !== "PUBLISHED") {
            throw new Error(manyVidsData?.error || "REMOTE_CONFIRMATION_FAILED");
          }
          manyVidsStaged = true;
          setPublicationProgress(58);
          setPublicationProgressLabel(t("confirmed"));
        } catch (error) {
          const errorKey = `errors.${error instanceof Error ? error.message : "UNKNOWN"}`;
          manyVidsFailure = t.has(errorKey) ? t(errorKey) : t("publicationFailed");
          setPublicationHasFailures(true);
          setPageError(manyVidsFailure);
        }
      }

      const instagramPublications =
        publishMode ===
          "NOW"
          ? publications.filter(
          (publication) =>
            publication.platform ===
            "INSTAGRAM",
          )
          : [];

      if (
        instagramPublications.length >
        0
      ) {
        setPublicationProgress(
          Math.max(
            publicationProgress,
            35,
          ),
        );

        const initialInstagramProgress:
          Record<
            string,
            InstagramAccountProgress
          > = {};

        for (
          let index = 0;
          index <
          instagramPublications.length;
          index += 1
        ) {
          const publication =
            instagramPublications[
              index
            ];

          const accountId =
            publication.platformAccountId ||
            selectedInstagramAccounts[
              index
            ]?.id ||
            publication.id;

          initialInstagramProgress[
            accountId
          ] = {
            status:
              "WAITING",
            progress:
              0,
          };
        }

        setInstagramAccountProgress(
          initialInstagramProgress,
        );

        const instagramResults:
          ExecuteInstagramResponse[] =
          [];

        const instagramFailures:
          Array<{
            accountId: string;
            message: string;
          }> = [];

        for (
          let index = 0;
          index <
          instagramPublications.length;
          index += 1
        ) {
          const publication =
            instagramPublications[
              index
            ];

          const accountId =
            publication.platformAccountId ||
            selectedInstagramAccounts[
              index
            ]?.id ||
            publication.id;

          const account =
            instagramAccounts.find(
              (item) =>
                item.id ===
                accountId,
            ) ??
            selectedInstagramAccounts[
              index
            ];

          const accountLabel =
            account
              ? getPlatformAccountDisplayName(
                  account,
                )
              : `${instagramAccountUi.accountFallback} ${
                  index + 1
                }`;

          setPublicationProgressLabel(
            `${instagramAccountUi.publishingTo} ${accountLabel} (${index + 1}/${instagramPublications.length})...`,
          );

          let estimatedAccountProgress =
            8;

          setInstagramAccountProgress(
            (current) => ({
              ...current,
              [accountId]: {
                status:
                  "PUBLISHING",
                progress:
                  estimatedAccountProgress,
              },
            }),
          );

          const progressTimer =
            window.setInterval(
              () => {
                estimatedAccountProgress =
                  Math.min(
                    92,
                    estimatedAccountProgress +
                      (estimatedAccountProgress <
                      70
                        ? 4
                        : 1),
                  );

                setInstagramAccountProgress(
                  (current) => ({
                    ...current,
                    [accountId]: {
                      status:
                        "PUBLISHING",
                      progress:
                        estimatedAccountProgress,
                    },
                  }),
                );

                const completedFraction =
                  index /
                  instagramPublications.length;

                const currentFraction =
                  estimatedAccountProgress /
                  100 /
                  instagramPublications.length;

                setPublicationProgress(
                  Math.min(
                    94,
                    Math.round(
                      35 +
                        (
                          completedFraction +
                          currentFraction
                        ) *
                          59,
                    ),
                  ),
                );
              },
              1500,
            );

          try {
            const executeResponse =
              await fetch(
                "/api/distribution/execute/instagram",
                {
                  method:
                    "POST",
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                  body:
                    JSON.stringify({
                      publicationId:
                        publication.id,
                      publishType:
                        instagramPublishType,
                    }),
                },
              );

            const responseText =
              await executeResponse.text();

            let executeData:
              ExecuteInstagramResponse;

            try {
              executeData =
                JSON.parse(
                  responseText,
                ) as ExecuteInstagramResponse;
            } catch {
              const contentType =
                executeResponse.headers
                  .get(
                    "content-type",
                  )
                  ?.toLowerCase() ??
                "";

              const looksLikeHtml =
                contentType.includes(
                  "text/html",
                ) ||
                responseText
                  .trim()
                  .startsWith(
                    "<!DOCTYPE",
                  ) ||
                responseText
                  .trim()
                  .startsWith(
                    "<html",
                  );

              executeData = {
                success:
                  false,
                error:
                  looksLikeHtml
                    ? `Publishing service returned HTTP ${executeResponse.status}. Please try again.`
                    : `Instagram returned HTTP ${executeResponse.status}.`,
              };
            }

            if (
              !executeResponse.ok ||
              !executeData.success
            ) {
              const errorMessage =
                executeData.message ||
                executeData.error ||
                ui.instagramFailed;

              instagramFailures.push({
                accountId,
                message:
                  errorMessage,
              });

              setInstagramAccountProgress(
                (current) => ({
                  ...current,
                  [accountId]: {
                    status:
                      "FAILED",
                    progress:
                      100,
                    message:
                      errorMessage,
                  },
                }),
              );

              continue;
            }

            instagramResults.push(
              executeData,
            );

            setInstagramAccountProgress(
              (current) => ({
                ...current,
                [accountId]: {
                  status:
                    "PUBLISHED",
                  progress:
                    100,
                },
              }),
            );

            setPublicationProgress(
              Math.min(
                94,
                Math.round(
                  35 +
                    (
                      (index + 1) /
                      instagramPublications.length
                    ) *
                      59,
                ),
              ),
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : ui.instagramFailed;

            instagramFailures.push({
              accountId,
              message:
                errorMessage,
            });

            setInstagramAccountProgress(
              (current) => ({
                ...current,
                [accountId]: {
                  status:
                    "FAILED",
                  progress:
                    100,
                  message:
                    errorMessage,
                },
              }),
            );
          } finally {
            window.clearInterval(
              progressTimer,
            );
          }
        }

        if (
          instagramFailures.length >
          0
        ) {
          const failedIds =
            instagramFailures.map(
              (item) =>
                item.accountId,
            );

          setSelectedPlatformIds(
            failedIds,
          );

          setPublicationHasFailures(
            true,
          );

          setPublicationProgress(
            100,
          );

          setPublicationProgressLabel(
            `${instagramResults.length} ${instagramAccountUi.published.toLowerCase()} · ${instagramFailures.length} ${instagramAccountUi.failed.toLowerCase()}`,
          );

          setPageError(
            `${instagramFailures.length} Instagram account(s) failed. ${instagramAccountUi.retryFailedOnly}`,
          );

          return;
        }

        if (manyVidsFailure) {
          setPublicationHasFailures(true);
          setPageError(manyVidsFailure);
          setPublicationProgress(100);
          setPublicationProgressLabel(t("otherDestinationsFinished"));
          return;
        }

        const handledManyVidsCount =
          manyVidsStaged
            ? manyVidsPublications.length
            : 0;

        const otherCount =
          publications.length -
          instagramResults.length -
          handledManyVidsCount;

        let completionMessage =
          instagramResults.length >
          1
            ? `${instagramResults.length} Instagram accounts published successfully.`
            : ui.instagramSuccess;

        if (manyVidsStaged) {
          completionMessage =
            otherCount > 0
              ? `${completionMessage} ${t("confirmed")} ${otherCount} ${ui.queuedOther}`
              : `${completionMessage} ${t("confirmed")}`;
        } else if (
          otherCount > 0
        ) {
          completionMessage =
            `${completionMessage} ${otherCount} ${ui.queuedOther}`;
        }

        await completePublicationAndReset(
          completionMessage,
        );
      } else if (manyVidsFailure) {
        setPublicationHasFailures(true);
        setPageError(manyVidsFailure);
        setPublicationProgressLabel(t("reviewBeforeRetry"));
      } else if (manyVidsStaged) {
        await completePublicationAndReset(
          publishMode ===
            "SCHEDULED"
            ? t("uploadConfigured")
            : t("confirmed"),
        );
      } else {
        await completePublicationAndReset(
          publishMode ===
            "SCHEDULED"
            ? ui.distributionScheduled
            : ui.distributionCreated,
        );
      }
    } catch (error) {
      console.error(
        "DISTRIBUTION_CREATE_ERROR",
        error,
      );

      setPageError(
        error instanceof Error
          ? (manyVidsSelected && t.has(`errors.${error.message}`) ? t(`errors.${error.message}`) : error.message)
          : ui.createDistributionError,
      );

      setPublicationProgress(
        0,
      );
      setPublicationProgressLabel(
        "",
      );
      setShowPublicationProgress(
        false,
      );
    } finally {
      setIsSubmitting(
        false,
      );
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#080b12]">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-400" />

          <div className="mt-3 text-xs text-white/30">
            {ui.loadingWorkspace}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#080b12] text-white">
      <div className="mx-auto w-full max-w-[1540px] px-5 py-6 sm:px-7 lg:px-8">
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
              <Send className="h-4 w-4 text-blue-300" />
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

        <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-[18px] border border-white/[0.07] bg-white/[0.018] p-4">
            <div className="mb-3 flex items-center gap-2">
              <UserRound className="h-4 w-4 text-blue-300" />

              <div className="text-xs font-semibold text-white/80">
                {ui.performerMedia}
              </div>
            </div>

            <label className="text-[10px] uppercase tracking-[0.1em] text-white/25">
              {ui.performer}
            </label>

            <select
              value={
                selectedPerformerId
              }
              onChange={(
                event,
              ) =>
                setSelectedPerformerId(
                  event.target.value,
                )
              }
              className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-[#0c111a] px-3 text-xs text-white outline-none"
            >
              {performers.length ===
                0 && (
                <option value="">
                  {
                    ui.choosePerformer
                  }
                </option>
              )}

              {performers.map(
                (performer) => (
                  <option
                    key={
                      performer.id
                    }
                    value={
                      performer.id
                    }
                  >
                    {
                      performer.displayName
                    }
                  </option>
                ),
              )}
            </select>

            <div className="mt-4">
              <label className="text-[10px] uppercase tracking-[0.1em] text-white/25">
                {ui.folder}
              </label>

              <select
                value={
                  selectedFolderId
                }
                onChange={(
                  event,
                ) =>
                  setSelectedFolderId(
                    event.target.value,
                  )
                }
                disabled={
                  !selectedPerformerId ||
                  isLoadingPerformerMedia
                }
                className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-[#0c111a] px-3 text-xs text-white outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                <option value="ALL">
                  {
                    ui.allFolders
                  }
                </option>

                {performerFolders.map(
                  (folder) => (
                    <option
                      key={
                        folder.id
                      }
                      value={
                        folder.id
                      }
                    >
                      {folderLabelById.get(
                        folder.id,
                      ) ||
                        folder.name}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="mt-4">
              <label className="text-[10px] uppercase tracking-[0.1em] text-white/25">
                {ui.media}
              </label>

              <button
                type="button"
                onClick={() =>
                  void openMediaPicker()
                }
                disabled={
                  !selectedPerformerId ||
                  isLoadingPerformerMedia
                }
                className="mt-2 flex w-full items-center gap-3 rounded-[14px] border border-white/[0.08] bg-[#0c111a] p-2.5 text-left transition hover:border-blue-500/25 hover:bg-[#0d131e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <div className="flex h-[58px] w-[96px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#090d14]">
                  {previewUrl ? (
                    selectedMedia?.mediaType
                      ?.trim()
                      .toUpperCase() ===
                    "IMAGE" ? (
                      <img
                        src={
                          previewUrl
                        }
                        alt={
                          selectedMedia.originalFileName
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <video
                        src={
                          previewUrl
                        }
                        preload="metadata"
                        muted
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : (
                    <FileVideo2 className="h-5 w-5 text-white/15" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-white/80">
                    {selectedMedia
                      ? selectedMedia.originalFileName
                      : ui.chooseVideo}
                  </div>

                  <div className="mt-1 text-[10px] text-white/25">
                    {selectedMedia
                      ? `${formatBytes(
                          Number(
                            selectedMedia.fileSize,
                          ),
                        )} · ${ui.readyToPublish}`
                      : isLoadingPerformerMedia
                        ? ui.loadingWorkspace
                        : !selectedPerformerId
                          ? ui.noPerformerSelected
                          : creatorMedia.length ===
                              0
                            ? ui.noMediaForPerformer
                            : `${creatorMedia.length} ${creatorMedia.length === 1 ? ui.videoAvailable : ui.videosAvailable}`}
                  </div>
                </div>

                <div className="shrink-0 rounded-lg border border-white/[0.07] px-2.5 py-1.5 text-[10px] font-medium text-white/40">
                  {selectedMedia
                    ? "Change"
                    : "Choose"}
                </div>
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#0c111a] p-3">
              <div className="flex min-h-[220px] items-center justify-center rounded-[12px] bg-[#0a0e16]">
                {previewUrl ? (
                  <div
                    className="max-w-full overflow-hidden rounded-[10px] bg-black"
                    style={{
                      aspectRatio:
                        previewAspectRatio,
                      width:
                        previewAspectRatio ===
                        "16 / 9"
                          ? "100%"
                          : "auto",
                      height:
                        previewAspectRatio ===
                        "16 / 9"
                          ? "auto"
                          : "min(520px, 65vh)",
                    }}
                  >
                    {selectedMedia?.mediaType
                      ?.trim()
                      .toUpperCase() ===
                    "IMAGE" ? (
                      <img
                        src={
                          previewUrl
                        }
                        alt={
                          selectedMedia.originalFileName
                        }
                        onLoad={(
                          event,
                        ) => {
                          const image =
                            event.currentTarget;

                          if (
                            image.naturalWidth >
                              0 &&
                            image.naturalHeight >
                              0
                          ) {
                            setPreviewAspectRatio(
                              `${image.naturalWidth} / ${image.naturalHeight}`,
                            );
                          }
                        }}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <video
                        src={
                          previewUrl
                        }
                        preload="metadata"
                        muted
                        playsInline
                        controls
                        onLoadedMetadata={(
                          event,
                        ) => {
                          const video =
                            event.currentTarget;

                          if (
                            video.videoWidth >
                              0 &&
                            video.videoHeight >
                              0
                          ) {
                            setPreviewAspectRatio(
                              `${video.videoWidth} / ${video.videoHeight}`,
                            );
                          }
                        }}
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex h-[220px] flex-col items-center justify-center text-white/15">
                    <FileVideo2 className="h-8 w-8" />

                    <span className="mt-2 text-[10px]">
                      {ui.selectAVideo}
                    </span>
                  </div>
                )}
              </div>

              {selectedMedia && (
                <div className="p-3">
                  <div className="truncate text-xs font-medium text-white/80">
                    {
                      selectedMedia.originalFileName
                    }
                  </div>

                  <div className="mt-1 text-[10px] text-white/25">
                    {formatBytes(
                      Number(
                        selectedMedia.fileSize,
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[18px] border border-white/[0.07] bg-white/[0.018] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-300" />

                <div className="text-xs font-semibold text-white/80">
                  {ui.captionPublishing}
                </div>
              </div>

              <div className="text-[10px] text-white/20">
                {caption.length}/2200
              </div>
            </div>

            <div className="mb-3 rounded-[14px] border border-violet-500/15 bg-violet-500/[0.035] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label className="text-[10px] uppercase tracking-[0.1em] text-white/25">
                    {ui.aiContext}
                  </label>

                  <input
                    value={
                      aiContext
                    }
                    onChange={(
                      event,
                    ) =>
                      setAiContext(
                        event.target.value,
                      )
                    }
                    placeholder={ui.aiPlaceholder}
                    className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-[#0c111a] px-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-violet-500/30"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void generateAiCaption()
                  }
                  disabled={
                    isGeneratingAi ||
                    !selectedMedia
                  }
                  className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/[0.1] px-4 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/[0.15] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isGeneratingAi ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {ui.generating}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      {ui.generateAi}
                    </>
                  )}
                </button>
              </div>

              <div className="mt-2 text-[9px] leading-4 text-white/20">
                {ui.aiHelp}
              </div>
            </div>

            {instagramSelected && (
              <div className="mb-3 flex flex-col gap-2 rounded-[14px] border border-pink-500/15 bg-pink-500/[0.035] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-semibold text-white/70">
                      {
                        instagramUi.title
                      }
                    </div>

                    <div className="rounded-full border border-pink-500/15 bg-pink-500/[0.06] px-2 py-0.5 text-[8px] font-medium text-pink-200/70">
                      Instagram
                    </div>
                  </div>

                  <div className="mt-1 text-[9px] text-white/25">
                    {
                      instagramUi.help
                    }
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {(
                    [
                      {
                        value:
                          "POST",
                        label:
                          instagramUi.post,
                      },
                      {
                        value:
                          "REEL",
                        label:
                          instagramUi.reel,
                      },
                      {
                        value:
                          "STORY",
                        label:
                          instagramUi.story,
                      },
                    ] as {
                      value: InstagramPublishType;
                      label: string;
                    }[]
                  ).map(
                    (option) => {
                      const selected =
                        instagramPublishType ===
                        option.value;

                      return (
                        <button
                          key={
                            option.value
                          }
                          type="button"
                          onClick={() =>
                            setInstagramPublishType(
                              option.value,
                            )
                          }
                          className={`flex h-8 min-w-[62px] items-center justify-center rounded-lg border px-2.5 text-[10px] font-semibold transition ${
                            selected
                              ? "border-pink-400/40 bg-pink-500/[0.12] text-pink-200"
                              : "border-white/[0.07] bg-[#0c111a] text-white/35 hover:border-white/[0.12] hover:text-white/60"
                          }`}
                        >
                          {
                            option.label
                          }
                        </button>
                      );
                    },
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setIsThumbnailOpen(
                      true,
                    )
                  }
                  disabled={
                    !selectedMedia
                  }
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/[0.055] px-2.5 text-[10px] font-semibold text-amber-200/80 transition hover:bg-amber-400/[0.09] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Thumbnail
                  <span className="text-[8px] font-medium text-amber-100/40">
                    {instagramPublishType ===
                    "POST"
                      ? "1:1"
                      : "9:16"}
                  </span>
                </button>
              </div>
            )}

            <textarea
              value={
                caption
              }
              onChange={(
                event,
              ) =>
                setCaption(
                  event.target.value.slice(
                    0,
                    2200,
                  ),
                )
              }
              placeholder={ui.captionPlaceholder}
              className="min-h-[124px] w-full resize-none rounded-[14px] border border-white/[0.08] bg-[#0c111a] p-3 text-xs leading-5 text-white outline-none placeholder:text-white/20 focus:border-blue-500/30"
            />

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[10px] text-white/25">
                {ui.generalCaptionHelp}
              </div>

              <button
                type="button"
                onClick={() =>
                  void generatePlatformCaptions()
                }
                disabled={
                  isGeneratingPlatformAi ||
                  !selectedMedia ||
                  selectedPlatformIds.length ===
                    0
                }
                className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/[0.08] px-3 text-[11px] font-semibold text-blue-200 transition hover:bg-blue-500/[0.13] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isGeneratingPlatformAi ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {ui.generatingPerPlatform}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    {ui.generatePerPlatform}
                  </>
                )}
              </button>
            </div>

            {selectedPlatformIds.length >
              0 &&
              Object.keys(
                platformCaptions,
              ).length >
                0 && (
                <div className="mt-3 grid gap-3">
                  {creatorAccounts
                    .filter(
                      (account) =>
                        selectedPlatformIds.includes(
                          account.id,
                        ),
                    )
                    .map(
                      (account) => (
                        <div
                          key={
                            account.id
                          }
                          className="rounded-[14px] border border-white/[0.07] bg-[#0c111a] p-3"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <PlatformIcon
                              platform={
                                account.platform
                              }
                              compact
                            />

                            <div className="text-[11px] font-semibold text-white/75">
                              {getPlatformLabel(
                                account.platform,
                              )}
                            </div>

                            <div className="ml-auto text-[9px] text-white/20">
                              {
                                (
                                  platformCaptions[
                                    account.id
                                  ] ??
                                  ""
                                ).length
                              }
                              /2200
                            </div>
                          </div>

                          <textarea
                            value={
                              platformCaptions[
                                account.id
                              ] ??
                              ""
                            }
                            onChange={(
                              event,
                            ) =>
                              setPlatformCaptions(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [account.id]:
                                    event.target.value.slice(
                                      0,
                                      2200,
                                    ),
                                }),
                              )
                            }
                            placeholder={`${ui.customCaptionFor} ${getPlatformLabel(
                              account.platform,
                            )}`}
                            className="min-h-[92px] w-full resize-none rounded-xl border border-white/[0.07] bg-[#090d14] p-3 text-[11px] leading-5 text-white outline-none placeholder:text-white/15 focus:border-blue-500/25"
                          />
                        </div>
                      ),
                    )}
                </div>
              )}

            {manyVidsSelected && (
              <div className="mt-3 overflow-hidden rounded-[12px] border border-white/[0.07] bg-[#0a0f18]">
                <div className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-2">
                  <PlatformIcon
                    platform="MANYVIDS"
                    compact
                  />

                  <span className="text-[11px] font-semibold text-white/75">
                    ManyVids
                  </span>

                  <span className="text-[9px] text-white/25">{t("videoSettings")}</span>

                  <span className="ml-auto rounded-md bg-pink-500/[0.08] px-2 py-1 text-[9px] font-medium text-pink-200/70">{t("required")}</span>
                </div>

                <div className="space-y-2.5 p-3">
                  <h3 className="text-sm font-semibold">{t("metadata")}</h3>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px]">
                    <div>
                      <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.08em] text-white/25">{t("title")}</div>

                      <input
                        value={
                          manyVidsTitle
                        }
                        onChange={(
                          event,
                        ) =>
                          setManyVidsTitle(
                            event.target.value.slice(
                              0,
                              180,
                            ),
                          )
                        }
                        placeholder={t("titlePlaceholder")}
                        className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#111722] px-3 text-[11px] font-medium text-white/85 outline-none placeholder:text-white/20 focus:border-pink-400/30"
                      />
                    </div>

                    <div>
                      <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.08em] text-white/25">{t("price")}</div>

                      <div className="flex h-9 overflow-hidden rounded-lg border border-emerald-400/20 bg-[#111722] focus-within:border-emerald-400/40">
                        <div className="flex w-8 shrink-0 items-center justify-center border-r border-white/[0.06] bg-emerald-400/[0.04] text-[12px] font-semibold text-emerald-300">
                          $
                        </div>

                        <input
                          value={
                            manyVidsPrice
                          }
                          onChange={(
                            event,
                          ) => {
                            const value =
                              event.target.value.replace(
                                /[^0-9.,]/g,
                                "",
                              );

                            setManyVidsPrice(
                              value,
                            );
                          }}
                          inputMode="decimal"
                          placeholder="9.99"
                          className="min-w-0 flex-1 bg-transparent px-3 text-[12px] font-semibold tabular-nums text-white outline-none placeholder:text-white/18"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-white/25">{t("description")}</span>

                      <button
                        type="button"
                        onClick={() => {
                          const next =
                            caption.slice(
                              0,
                              5000,
                            );

                          setManyVidsDescription(
                            next,
                          );


                        }}
                        className="text-[9px] font-medium text-blue-300/65 transition hover:text-blue-200"
                      >{t("useCaption")}</button>
                    </div>

                    <textarea
                      value={
                        manyVidsDescription
                      }
                      onChange={(
                        event,
                      ) =>
                        setManyVidsDescription(
                          event.target.value.slice(
                            0,
                            5000,
                          ),
                        )
                      }
                      placeholder={t("descriptionPlaceholder")}
                      className="min-h-[68px] w-full resize-none rounded-lg border border-white/[0.08] bg-[#111722] px-3 py-2.5 text-[11px] leading-5 text-white/80 outline-none placeholder:text-white/18 focus:border-pink-400/30"
                    />
                  </div>

                  <p className="text-xs text-white/60">{t("scheduleTimezone", {timeZone:scheduleTimeZone})}</p>
                  <ManyVidsTagPicker accountId={manyVidsAccount?.id ?? ""} value={manyVidsTags} onChange={setManyVidsTags} />
                  <ManyVidsPublishingOptions
                    key={selectedCreatorId + ":" + selectedMediaId}
                    value={manyVidsOptions} onChange={setManyVidsOptions}
                    accountId={manyVidsAccount?.id ?? ""} videoDuration={selectedMedia?.durationSeconds ?? null} onVideoMetadata={setManyVidsVideoMetadata}
                    mediaId={selectedMediaId} performerId={selectedPerformerId} locale={locale} publishMode={publishMode}
                    onBlockReason={setManyVidsBlockReason}
                  />
                  {manyVidsPublishBlockReason && <p role="status" className="rounded-lg border border-amber-300/20 p-3 text-xs text-amber-200">{t("publishBlocked", { reason: manyVidsPublishBlockReason })}</p>}
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-white/[0.06] pt-4">
              {publishMode ===
                "SCHEDULED" &&
                scheduledAt && (
                  <div className="mb-3 flex items-center gap-3 rounded-xl border border-violet-500/15 bg-violet-500/[0.045] px-3 py-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/[0.1] text-violet-300">
                      <Clock3 className="h-4 w-4" />
                    </div>

                    <button
                      type="button"
                      onClick={
                        openSchedule
                      }
                      disabled={isSubmitting}
                  title={manyVidsSelected ? t("internalScheduleHelp") : undefined}
                  className="min-w-0 flex-1 text-left"
                    >
                      <div className="text-[9px] text-white/25">
                        {ui.scheduledPublication}
                      </div>

                      <div className="mt-0.5 truncate text-[11px] font-medium text-white/75">
                        {formatFullSchedule(
                          scheduledAt,
                          locale,
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPublishMode(
                          "NOW",
                        );
                        setScheduledAt(
                          "",
                        );
                        setIsScheduleOpen(
                          false,
                        );
                      }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] text-white/30 transition hover:border-white/[0.12] hover:text-white/60"
                      aria-label={manyVidsSelected ? t("removeSchedule") : "Remove schedule"}
                      title={manyVidsSelected ? t("removeSchedule") : "Remove schedule"}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

              {showPublicationProgress && (
                <div className="mb-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.045] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 text-[10px] font-medium text-blue-100/75">
                      {publicationProgressLabel ||
                        ui.publishing}
                    </div>

                    <div className="shrink-0 text-[11px] font-semibold tabular-nums text-blue-200">
                      {publicationProgress}%
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-[width] duration-500 ease-out"
                      style={{
                        width: `${publicationProgress}%`,
                      }}
                    />
                  </div>

                  {Object.keys(
                    instagramAccountProgress,
                  ).length >
                    0 && (
                    <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-2.5">
                      {Object.entries(
                        instagramAccountProgress,
                      ).map(
                        ([
                          accountId,
                          item,
                        ]) => {
                          const account =
                            instagramAccounts.find(
                              (
                                candidate,
                              ) =>
                                candidate.id ===
                                accountId,
                            );

                          const label =
                            account
                              ? getPlatformAccountDisplayName(
                                  account,
                                )
                              : instagramAccountUi.accountFallback;

                          return (
                            <div
                              key={
                                accountId
                              }
                              className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 truncate text-[9px] font-medium text-white/60">
                                  {
                                    label
                                  }
                                </div>

                                <div
                                  className={`shrink-0 text-[8px] font-semibold ${
                                    item.status ===
                                    "PUBLISHED"
                                      ? "text-emerald-300"
                                      : item.status ===
                                          "FAILED"
                                        ? "text-red-300"
                                        : item.status ===
                                            "PUBLISHING"
                                          ? "text-blue-300"
                                          : "text-white/30"
                                  }`}
                                >
                                  {item.status ===
                                  "PUBLISHED"
                                    ? `100% · ${instagramAccountUi.published}`
                                    : item.status ===
                                        "FAILED"
                                      ? instagramAccountUi.failed
                                      : item.status ===
                                          "PUBLISHING"
                                        ? `${item.progress}%`
                                        : instagramAccountUi.waiting}
                                </div>
                              </div>

                              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                  className={`h-full rounded-full transition-[width] duration-500 ${
                                    item.status ===
                                    "FAILED"
                                      ? "bg-red-400"
                                      : item.status ===
                                          "PUBLISHED"
                                        ? "bg-emerald-400"
                                        : "bg-blue-400"
                                  }`}
                                  style={{
                                    width: `${item.progress}%`,
                                  }}
                                />
                              </div>

                              {item.message &&
                                item.status ===
                                  "FAILED" && (
                                  <div className="mt-1 text-[8px] leading-3 text-red-200/55">
                                    {
                                      item.message
                                    }
                                  </div>
                                )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}

                  {publicationProgress ===
                    100 &&
                    !publicationHasFailures && (
                    <div className="mt-2 flex items-center gap-1.5 text-[9px] text-emerald-300/75">
                      <CheckCircle2 className="h-3 w-3" />
                      {manyVidsSelected ? t("formClearsSoon") : "Done. This form will clear automatically in 3 seconds."}
                    </div>
                  )}

                  {publicationProgress ===
                    100 &&
                    publicationHasFailures && (
                    <div className="mt-2 flex items-center gap-1.5 text-[9px] text-red-300/75">
                      <CircleAlert className="h-3 w-3" />
                      {
                        instagramAccountUi.retryFailedOnly
                      }
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={
                    openSchedule
                  }
                  disabled={isSubmitting}
                  title={manyVidsSelected ? t("internalScheduleHelp") : undefined}
                  className="flex h-9 items-center justify-center gap-2 rounded-lg border border-violet-500/25 bg-violet-500/[0.06] px-3.5 text-[11px] font-medium text-violet-200 transition hover:bg-violet-500/[0.1]"
                >
                  <CalendarClock className="h-3.5 w-3.5" />

                  {scheduledAt
                    ? formatScheduleButton(
                        scheduledAt,
                        locale,
                        ui.schedule,
                      )
                    : ui.schedule}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void submitDistribution()
                  }
                  disabled={isSubmitting || (manyVidsSelected && Boolean(manyVidsPublishBlockReason))}
                  title={manyVidsSelected ? manyVidsPublishBlockReason : undefined}
                  className="flex h-9 min-w-[126px] items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 px-4 text-[11px] font-semibold text-white shadow-[0_10px_28px_rgba(99,102,241,0.14)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {ui.publishing}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />

                      {publishMode ===
                      "SCHEDULED"
                        ? ui.schedulePublication
                        : ui.publishNow}
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-4 rounded-[18px] border border-white/[0.07] bg-white/[0.018] p-4">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold text-white/80">
                {ui.selectPlatforms}
              </div>

              <div className="mt-1 text-[10px] text-white/25">
                {ui.chooseDestinations}
              </div>
            </div>

            <div className="text-[10px] text-white/25">
              {
                creatorAccounts.length
              }{" "}
              connected
            </div>
          </div>

          {creatorAccounts.length ===
          0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center text-xs text-white/25">
              {ui.noConnectedPlatforms}
            </div>
          ) : (
            <div className="space-y-3">
              {instagramAccounts.length >
                0 && (
                <div className="rounded-[16px] border border-pink-400/[0.12] bg-gradient-to-br from-pink-500/[0.045] via-[#0c111a] to-violet-500/[0.035] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <PlatformIcon
                        platform="INSTAGRAM"
                      />

                      <div>
                        <div className="text-[11px] font-semibold text-white/80">
                          {
                            instagramAccountUi.accounts
                          }
                        </div>

                        <div className="mt-0.5 text-[9px] text-white/30">
                          {
                            selectedInstagramAccounts.length
                          }{" "}
                          {instagramAccountUi.selected}{" "}
                          ·{" "}
                          {
                            instagramAccounts.length
                          }{" "}
                          {ui.connected}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={
                        toggleAllInstagram
                      }
                      className={`flex h-8 items-center justify-center gap-2 rounded-lg border px-3 text-[9px] font-semibold transition ${
                        allInstagramSelected
                          ? "border-blue-400/35 bg-blue-500/[0.12] text-blue-100"
                          : "border-white/[0.08] bg-white/[0.03] text-white/45 hover:bg-white/[0.06] hover:text-white/70"
                      }`}
                    >
                      <div
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                          allInstagramSelected
                            ? "border-blue-400 bg-blue-500 text-white"
                            : "border-white/20"
                        }`}
                      >
                        {allInstagramSelected && (
                          <Check className="h-2.5 w-2.5" />
                        )}
                      </div>

                      {allInstagramSelected
                        ? instagramAccountUi.clear
                        : instagramAccountUi.selectAll}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {instagramAccounts.map(
                      (account) => {
                        const selected =
                          selectedPlatformIds.includes(
                            account.id,
                          );

                        const displayName =
                          getPlatformAccountDisplayName(
                            account,
                          );

                        const username =
                          account.externalUsername?.trim();

                        const normalizedUsername =
                          username
                            ? username.startsWith(
                                "@",
                              )
                              ? username
                              : `@${username}`
                            : null;

                        return (
                          <button
                            key={
                              account.id
                            }
                            type="button"
                            onClick={() =>
                              togglePlatform(
                                account.id,
                              )
                            }
                            className={`relative flex min-h-[72px] items-center gap-3 rounded-[13px] border px-3 text-left transition ${
                              selected
                                ? "border-pink-400/35 bg-pink-500/[0.08]"
                                : "border-white/[0.07] bg-black/15 hover:border-white/[0.12]"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate pr-6 text-[10px] font-semibold text-white/80">
                                {
                                  displayName
                                }
                              </div>

                              {normalizedUsername &&
                                displayName !==
                                  normalizedUsername &&
                                displayName !==
                                  username && (
                                  <div className="mt-0.5 truncate pr-6 text-[8px] text-white/25">
                                    {
                                      normalizedUsername
                                    }
                                  </div>
                                )}

                              <div className="mt-1 flex items-center gap-1.5 text-[8px] text-emerald-300/65">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                {
                                  ui.connectedLabel
                                }
                              </div>
                            </div>

                            <div
                              className={`absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full border ${
                                selected
                                  ? "border-pink-300 bg-pink-500 text-white"
                                  : "border-white/15"
                              }`}
                            >
                              {selected && (
                                <Check className="h-2.5 w-2.5" />
                              )}
                            </div>
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {creatorAccounts
                  .filter(
                    (account) =>
                      account.platform !==
                      "INSTAGRAM",
                  )
                  .map(
                    (account) => {
                      const selected =
                        selectedPlatformIds.includes(
                          account.id,
                        );

                      return (
                        <button
                          key={
                            account.id
                          }
                          type="button"
                          onClick={() =>
                            togglePlatform(
                              account.id,
                            )
                          }
                          className={`relative flex min-h-[72px] items-center gap-3 rounded-[13px] border px-3 text-left transition ${
                            selected
                              ? "border-blue-500/40 bg-gradient-to-br from-blue-500/[0.11] to-violet-500/[0.05]"
                              : "border-white/[0.07] bg-[#0c111a] hover:border-white/[0.12]"
                          }`}
                        >
                          <PlatformIcon
                            platform={
                              account.platform
                            }
                          />

                          <div className="min-w-0 flex-1">
                            <div className="truncate pr-5 text-[11px] font-semibold text-white/80">
                              {getPlatformAccountDisplayName(
                                account,
                              )}
                            </div>

                            <div className="mt-0.5 truncate text-[8px] text-white/25">
                              {getPlatformLabel(
                                account.platform,
                              )}
                            </div>

                            <div className="mt-1 flex items-center gap-1.5 text-[9px] text-emerald-300/70">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              {
                                ui.connectedLabel
                              }
                            </div>
                          </div>

                          <div
                            className={`absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full border ${
                              selected
                                ? "border-blue-400 bg-blue-500 text-white"
                                : "border-white/15"
                            }`}
                          >
                            {selected && (
                              <Check className="h-2.5 w-2.5" />
                            )}
                          </div>
                        </button>
                      );
                    },
                  )}
              </div>
            </div>
          )}

        </section>

        <section className="mt-4 flex flex-col gap-3 rounded-[18px] border border-white/[0.07] bg-gradient-to-r from-white/[0.025] to-blue-500/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-white/80">
              {ui.publishingSummary}
            </div>

            <div className="mt-1 text-[10px] text-white/25">
              {selectedPlatformIds.length ===
              0
                ? ui.noDestination
                : `${selectedPlatformIds.length} ${selectedPlatformIds.length === 1 ? ui.destinationSelected : ui.destinationsSelected}`}
            </div>

            {publishMode ===
              "SCHEDULED" &&
              scheduledAt && (
                <div className="mt-1 text-[10px] text-violet-300/70">
                  {formatFullSchedule(
                    scheduledAt,
                    locale,
                  )}
                </div>
              )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {creatorAccounts
              .filter(
                (account) =>
                  selectedPlatformIds.includes(
                    account.id,
                  ),
              )
              .map(
                (account) => (
                  <div
                    key={
                      account.id
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-[#0c111a]"
                    title={`${getPlatformAccountDisplayName(
                      account,
                    )} · ${getPlatformLabel(
                      account.platform,
                    )}`}
                  >
                    <PlatformIcon
                      platform={
                        account.platform
                      }
                      compact
                    />
                  </div>
                ),
              )}
          </div>

        </section>
      </div>

      {isMediaPickerOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[82vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#0b1018] shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileVideo2 className="h-4 w-4 text-blue-300" />

                  <div className="text-sm font-semibold">
                    {ui.chooseVideoTitle}
                  </div>
                </div>

                <div className="mt-1 text-[10px] text-white/25">
                  {ui.pickMedia}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsMediaPickerOpen(
                    false,
                  )
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.05] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-white/[0.06] px-5 py-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_210px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />

                  <input
                    value={
                      mediaPickerSearch
                    }
                    onChange={(
                      event,
                    ) =>
                      setMediaPickerSearch(
                        event.target.value,
                      )
                    }
                    placeholder={ui.searchVideos}
                    autoFocus
                    className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#090d14] pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-blue-500/30"
                  />
                </div>

                <div className="relative">
                  <Tag className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-violet-300/60" />

                  <select
                    value={
                      mediaPickerCategoryId
                    }
                    onChange={(
                      event,
                    ) =>
                      setMediaPickerCategoryId(
                        event.target.value,
                      )
                    }
                    className="h-10 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#090d14] pl-9 pr-8 text-[11px] text-white/55 outline-none focus:border-violet-500/30"
                  >
                    <option value="ALL">
                      {ui.allCategories}
                    </option>

                    {mediaCategories.map(
                      (
                        category,
                      ) => (
                        <option
                          key={
                            category.id
                          }
                          value={
                            category.id
                          }
                        >
                          {
                            category.name
                          }
                        </option>
                      ),
                    )}
                  </select>

                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[8px] text-white/20">
                    ▼
                  </span>
                </div>
              </div>
            </div>

            <div className="min-h-[220px] flex-1 overflow-y-auto p-3 sm:p-4">
              {isLoadingMediaPicker &&
              Object.keys(
                mediaPickerPreviews,
              ).length ===
                0 ? (
                <div className="flex min-h-[220px] items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-400" />

                    <div className="mt-2 text-[10px] text-white/25">
                      {ui.loadingPreviews}
                    </div>
                  </div>
                </div>
              ) : filteredPickerMedia.length ===
                0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                  <FileVideo2 className="h-7 w-7 text-white/15" />

                  <div className="mt-3 text-xs font-medium text-white/45">
                    {ui.noVideosFound}
                  </div>

                  <div className="mt-1 text-[10px] text-white/20">
                    {ui.tryAnother}
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  {filteredPickerMedia.map(
                    (item) => {
                      const selected =
                        item.id ===
                        selectedMediaId;

                      const itemPreview =
                        mediaPickerPreviews[
                          item.id
                        ];

                      return (
                        <button
                          key={
                            item.id
                          }
                          type="button"
                          onClick={() =>
                            selectMediaFromPicker(
                              item.id,
                            )
                          }
                          className={`flex w-full items-center gap-3 rounded-[14px] border p-2.5 text-left transition ${
                            selected
                              ? "border-blue-500/35 bg-blue-500/[0.08]"
                              : "border-white/[0.07] bg-[#0c111a] hover:border-white/[0.12] hover:bg-[#0d131e]"
                          }`}
                        >
                          <div className="flex h-[62px] w-[108px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#090d14]">
                            {itemPreview ? (
                              item.mediaType
                                ?.trim()
                                .toUpperCase() ===
                              "IMAGE" ? (
                                <img
                                  src={
                                    itemPreview
                                  }
                                  alt={
                                    item.originalFileName
                                  }
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <video
                                  src={
                                    itemPreview
                                  }
                                  preload="metadata"
                                  muted
                                  playsInline
                                  className="h-full w-full object-cover"
                                />
                              )
                            ) : (
                              <FileVideo2 className="h-5 w-5 text-white/15" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-white/80">
                              {
                                item.originalFileName
                              }
                            </div>

                            <div className="mt-1 text-[10px] text-white/25">
                              {formatBytes(
                                Number(
                                  item.fileSize,
                                ),
                              )}
                              {" · "}
                              {item.status ===
                              "UPLOADED"
                                ? ui.ready
                                : item.status}
                            </div>


                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {(
                                mediaCategoryAssignments[
                                  item.id
                                ] ??
                                []
                              )
                                .slice(
                                  0,
                                  3,
                                )
                                .map(
                                  (
                                    category,
                                  ) => (
                                    <span
                                      key={
                                        category.id
                                      }
                                      className="rounded-full border border-violet-500/15 bg-violet-500/[0.06] px-1.5 py-0.5 text-[8px] text-violet-200/75"
                                    >
                                      {
                                        category.name
                                      }
                                    </span>
                                  ),
                                )}

                              {(
                                mediaCategoryAssignments[
                                  item.id
                                ] ??
                                []
                              ).length >
                                3 && (
                                <span className="text-[8px] text-white/20">
                                  +
                                  {(
                                    mediaCategoryAssignments[
                                      item.id
                                    ] ??
                                    []
                                  ).length -
                                    3}
                                </span>
                              )}
                            </div>
                          </div>

                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? "border-blue-400 bg-blue-500 text-white"
                                : "border-white/[0.08] text-transparent"
                            }`}
                          >
                            <Check className="h-3 w-3" />
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3">
              <div className="text-[10px] text-white/20">
                {filteredPickerMedia.length} {ui.of}{" "}
                {creatorMedia.length} {ui.videos}
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsMediaPickerOpen(
                    false,
                  )
                }
                className="rounded-xl border border-white/[0.07] px-4 py-2 text-[11px] text-white/40 transition hover:bg-white/[0.04] hover:text-white"
              >
                {ui.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {isThumbnailOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-5">
          <div className="w-full max-w-[760px] overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#0b1018] shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/[0.08] text-amber-200">
                  <ImageIcon className="h-4 w-4" />
                </div>

                <div>
                  <div className="text-xs font-semibold text-white/85">
                    Thumbnail
                  </div>

                  <div className="mt-0.5 text-[9px] text-white/30">
                    {instagramPublishType ===
                    "POST"
                      ? "Instagram Post · 1:1"
                      : instagramPublishType ===
                          "REEL"
                        ? "Instagram Reel · 9:16 cover"
                        : "Instagram Story · 9:16"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsThumbnailOpen(
                    false,
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.05] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!selectedMedia ? (
              <div className="p-5 text-[11px] text-white/35">
                Select media first.
              </div>
            ) : selectedMedia.mediaType
                ?.trim()
                .toUpperCase() ===
              "IMAGE" ? (
              <div className="grid gap-4 p-4 sm:grid-cols-[220px_1fr]">
                <div className="overflow-hidden rounded-[16px] border border-white/[0.08] bg-black/20">
                  {previewUrl ? (
                    <img
                      src={
                        previewUrl
                      }
                      alt={
                        selectedMedia.originalFileName
                      }
                      className="aspect-square h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center text-white/20">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-center">
                  <div className="text-xs font-semibold text-white/80">
                    Post image
                  </div>

                  <div className="mt-2 text-[10px] leading-5 text-white/35">
                    For an Instagram image Post, the selected image is the published content itself. Instagram does not use a separate thumbnail file for this Post type.
                  </div>

                  <div className="mt-4 rounded-xl border border-blue-500/15 bg-blue-500/[0.045] px-3 py-2.5 text-[9px] text-blue-200/65">
                    Output format: 1:1 preview
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-[250px_1fr]">
                <div>
                  <div
                    className={`mx-auto overflow-hidden rounded-[16px] border border-white/[0.08] bg-black/40 ${
                      instagramPublishType ===
                      "POST"
                        ? "aspect-square"
                        : "aspect-[9/16]"
                    }`}
                  >
                    {thumbnailPreviewUrl ? (
                      <img
                        src={
                          thumbnailPreviewUrl
                        }
                        alt="Saved thumbnail"
                        className="h-full w-full object-cover"
                      />
                    ) : previewUrl ? (
                      <video
                        ref={
                          thumbnailVideoRef
                        }
                        src={
                          selectedMediaId
                            ? `/api/media/${selectedMediaId}/thumbnail-source`
                            : ""
                        }
                        preload="metadata"
                        playsInline
                        muted
                        onLoadedMetadata={(
                          event,
                        ) => {
                          const duration =
                            event.currentTarget.duration;

                          setThumbnailDuration(
                            Number.isFinite(
                              duration,
                            )
                              ? duration
                              : 0,
                          );

                          const initial =
                            Number.isFinite(
                              duration,
                            )
                              ? Math.min(
                                  Math.max(
                                    duration *
                                      0.25,
                                    0,
                                  ),
                                  duration,
                                )
                              : 0;

                          event.currentTarget.currentTime =
                            initial;

                          setThumbnailTime(
                            initial,
                          );
                        }}
                        onSeeked={(
                          event,
                        ) =>
                          setThumbnailTime(
                            event.currentTarget.currentTime,
                          )
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/20">
                        <FileVideo2 className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-white/80">
                    Extract frame
                  </div>

                  <div className="mt-1 text-[9px] leading-4 text-white/30">
                    Move to the frame you want and save it as the thumbnail.
                  </div>

                  <div className="mt-4">
                    <input
                      type="range"
                      min={0}
                      max={
                        Math.max(
                          thumbnailDuration,
                          0,
                        )
                      }
                      step={0.05}
                      value={
                        Math.min(
                          thumbnailTime,
                          Math.max(
                            thumbnailDuration,
                            0,
                          ),
                        )
                      }
                      onChange={(
                        event,
                      ) =>
                        seekThumbnailVideo(
                          Number(
                            event.target.value,
                          ),
                        )
                      }
                      disabled={
                        !thumbnailDuration ||
                        Boolean(
                          thumbnailPreviewUrl,
                        )
                      }
                      className="w-full accent-blue-500 disabled:opacity-35"
                    />

                    <div className="mt-1 flex items-center justify-between text-[8px] text-white/25">
                      <span>
                        {thumbnailTime.toFixed(
                          1,
                        )}
                        s
                      </span>

                      <span>
                        {thumbnailDuration.toFixed(
                          1,
                        )}
                        s
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {thumbnailPreviewUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setThumbnailPreviewUrl(
                            "",
                          );

                          const video =
                            thumbnailVideoRef.current;

                          if (video) {
                            video.currentTime =
                              thumbnailTime;
                          }
                        }}
                        className="flex h-9 items-center justify-center rounded-lg border border-white/[0.08] px-3 text-[10px] font-medium text-white/45 transition hover:bg-white/[0.04] hover:text-white"
                      >
                        Choose another frame
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        void saveCurrentFrameAsThumbnail()
                      }
                      disabled={
                        isSavingThumbnail ||
                        !selectedMediaId ||
                        !thumbnailDuration ||
                        Boolean(
                          thumbnailPreviewUrl,
                        )
                      }
                      className="flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-500 px-3.5 text-[10px] font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isSavingThumbnail ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-3.5 w-3.5" />
                          Save frame
                        </>
                      )}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-2">
                    <input
                      ref={
                        thumbnailFileInputRef
                      }
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(
                        event,
                      ) =>
                        void handleThumbnailFile(
                          event.target.files?.[0] ??
                            null,
                        )
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        thumbnailFileInputRef.current?.click()
                      }
                      disabled={
                        isSavingThumbnail ||
                        isGeneratingThumbnailAi
                      }
                      className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.055] px-3 text-[10px] font-semibold text-amber-100/80 transition hover:bg-amber-400/[0.09] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Choose thumbnail file
                    </button>

                    <div className="rounded-[14px] border border-violet-400/15 bg-violet-500/[0.035] p-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-violet-300" />

                        <div className="text-[10px] font-semibold text-white/70">
                          Generate with AI
                        </div>
                      </div>

                      <textarea
                        value={
                          aiThumbnailPrompt
                        }
                        onChange={(
                          event,
                        ) =>
                          setAiThumbnailPrompt(
                            event.target.value,
                          )
                        }
                        rows={3}
                        maxLength={800}
                        placeholder="Describe the thumbnail you want. Example: cinematic beach scene, elegant, high contrast, no text."
                        className="mt-2 w-full resize-none rounded-lg border border-white/[0.07] bg-[#090d14] px-3 py-2 text-[10px] text-white/75 outline-none placeholder:text-white/20 focus:border-violet-400/30"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          void generateAiThumbnail()
                        }
                        disabled={
                          isGeneratingThumbnailAi ||
                          isSavingThumbnail
                        }
                        className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-3 text-[10px] font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isGeneratingThumbnailAi ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            Generate thumbnail
                          </>
                        )}
                      </button>

                      <div className="mt-2 text-[8px] leading-4 text-white/25">
                        {instagramPublishType ===
                        "POST"
                          ? "AI output: square 1:1."
                          : "AI output: vertical 9:16."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isScheduleOpen && (
        <ScheduleModal
          locale={locale}
          ui={ui}
          timeZone={manyVidsSelected ? scheduleTimeZone : Intl.DateTimeFormat().resolvedOptions().timeZone}
          error={scheduleError}
          calendarMonth={
            calendarMonth
          }
          scheduleDate={
            scheduleDate
          }
          scheduleTime={
            scheduleTime
          }
          onClose={() =>
            setIsScheduleOpen(
              false,
            )
          }
          onPreviousMonth={() =>
            setCalendarMonth(
              (current) =>
                new Date(
                  current.getFullYear(),
                  current.getMonth() -
                    1,
                  1,
                ),
            )
          }
          onNextMonth={() =>
            setCalendarMonth(
              (current) =>
                new Date(
                  current.getFullYear(),
                  current.getMonth() +
                    1,
                  1,
                ),
            )
          }
          onSelectDate={
            selectCalendarDate
          }
          onSelectTime={
            setScheduleTime
          }
          onToday={() =>
            selectQuickDate(
              0,
            )
          }
          onTomorrow={() =>
            selectQuickDate(
              1,
            )
          }
          onNextWeek={() =>
            selectQuickDate(
              7,
            )
          }
          onConfirm={
            confirmSchedule
          }
        />
      )}
    </main>
  );
}

function ScheduleModal({
  timeZone, error,
  locale,
  ui,
  calendarMonth,
  scheduleDate,
  scheduleTime,
  onClose,
  onPreviousMonth,
  onNextMonth,
  onSelectDate,
  onSelectTime,
  onToday,
  onTomorrow,
  onNextWeek,
  onConfirm,
}: {
  timeZone: string; error: string;
  locale: string;
  ui: Record<string, string>;
  calendarMonth: Date;
  scheduleDate: string;
  scheduleTime: string;
  onClose: () => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (
    date: Date,
  ) => void;
  onSelectTime: (
    value: string,
  ) => void;
  onToday: () => void;
  onTomorrow: () => void;
  onNextWeek: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("manyVids");
  const days =
    getCalendarDays(
      calendarMonth,
    );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-5">
      <div className="w-full max-w-[680px] overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#0b1018] shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-violet-300" />

              <div className="text-sm font-semibold">
                {ui.schedulePublication}
              </div>
            </div>

            <div className="mt-1 text-[10px] text-white/25">
              {ui.scheduleHelp}
              <span className="block">{t("scheduleTimezone", {timeZone})}</span>
              {error && <span role="alert" className="block text-red-300">{error}</span>}
            </div>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-0 md:grid-cols-[1fr_220px]">
          <div className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={
                  onPreviousMonth
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/35 transition hover:bg-white/[0.04] hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-xs font-semibold text-white/80">
                {new Intl.DateTimeFormat(
                  locale,
                  {
                    month:
                      "long",
                    year:
                      "numeric",
                  },
                ).format(
                  calendarMonth,
                )}
              </div>

              <button
                type="button"
                onClick={
                  onNextMonth
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/35 transition hover:bg-white/[0.04] hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {getWeekDays(locale).map(
                (day) => (
                  <div
                    key={
                      day
                    }
                    className="pb-2 text-center text-[9px] font-medium uppercase tracking-[0.08em] text-white/20"
                  >
                    {day}
                  </div>
                ),
              )}

              {days.map(
                ({
                  date,
                  currentMonth,
                }) => {
                  const value =
                    getDateInputValue(
                      date,
                    );

                  const selected =
                    value ===
                    scheduleDate;

                  const today = value === wallTime(new Date(), timeZone).slice(0, 10);

                  return (
                    <button
                      key={
                        value
                      }
                      type="button"
                      onClick={() =>
                        onSelectDate(
                          date,
                        )
                      }
                      className={`relative flex aspect-square items-center justify-center rounded-lg text-[11px] transition ${
                        selected
                          ? "bg-gradient-to-br from-blue-500 to-violet-500 font-semibold text-white shadow-[0_5px_15px_rgba(99,102,241,0.25)]"
                          : currentMonth
                            ? "text-white/65 hover:bg-white/[0.05] hover:text-white"
                            : "text-white/15 hover:bg-white/[0.025]"
                      }`}
                    >
                      {
                        date.getDate()
                      }

                      {today &&
                        !selected && (
                          <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-400" />
                        )}
                    </button>
                  );
                },
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <QuickDateButton
                label={ui.today}
                onClick={
                  onToday
                }
              />

              <QuickDateButton
                label={ui.tomorrow}
                onClick={
                  onTomorrow
                }
              />

              <QuickDateButton
                label={ui.nextWeek}
                onClick={
                  onNextWeek
                }
              />
            </div>
          </div>

          <div className="border-t border-white/[0.06] bg-white/[0.012] p-4 sm:p-5 md:border-l md:border-t-0">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.1em] text-white/25">
              <Clock3 className="h-3.5 w-3.5" />
              {ui.time}
            </div>

            <input
              type="time"
              value={
                scheduleTime
              }
              onChange={(
                event,
              ) =>
                onSelectTime(
                  event.target
                    .value,
                )
              }
              className="mt-3 h-11 w-full rounded-xl border border-white/[0.08] bg-[#0a0e16] px-3 text-center text-sm font-semibold text-white outline-none focus:border-violet-500/40"
            />

            <div className="mt-4 text-[10px] uppercase tracking-[0.1em] text-white/20">
              {ui.quickTime}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                "09:00",
                "12:00",
                "15:00",
                "18:00",
              ].map(
                (time) => (
                  <button
                    key={
                      time
                    }
                    type="button"
                    onClick={() =>
                      onSelectTime(
                        time,
                      )
                    }
                    className={`rounded-lg border px-2 py-2 text-[10px] transition ${
                      scheduleTime ===
                      time
                        ? "border-violet-500/35 bg-violet-500/[0.1] text-violet-200"
                        : "border-white/[0.07] text-white/35 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    {formatTimeValue(
                      time,
                      locale,
                    )}
                  </button>
                ),
              )}
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.06] bg-[#0a0e16] p-3">
              <div className="text-[9px] uppercase tracking-[0.1em] text-white/20">
                {ui.publicationTime}
              </div>

              <div className="mt-1.5 text-xs font-medium leading-5 text-white/75">
                {formatSchedulePreview(
                  scheduleDate,
                  scheduleTime,
                  locale,
                  ui.chooseDateTime,
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-xl border border-white/[0.07] px-4 py-2.5 text-xs text-white/40 transition hover:bg-white/[0.04] hover:text-white"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={
              onConfirm
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-2.5 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.16)] transition hover:brightness-110"
          >
            <Check className="h-3.5 w-3.5" />
            {ui.confirmSchedule}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickDateButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[10px] text-white/40 transition hover:bg-white/[0.05] hover:text-white"
    >
      {label}
    </button>
  );
}

function PlatformIcon({
  platform,
  compact = false,
}: {
  platform: string;
  compact?: boolean;
}) {
  const size =
    compact
      ? "h-6 w-6 text-[9px]"
      : "h-9 w-9 text-[11px]";

  const common =
    `${size} flex shrink-0 items-center justify-center rounded-lg font-bold`;

  switch (platform) {
    case "INSTAGRAM":
      return (
        <div
          className={`${common} bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400 text-white`}
        >
          IG
        </div>
      );

    case "FACEBOOK":
      return (
        <div
          className={`${common} bg-blue-600 text-white`}
        >
          f
        </div>
      );

    case "FANVUE":
      return (
        <div
          className={`${common} bg-pink-500 text-white`}
        >
          F
        </div>
      );

    case "X":
      return (
        <div
          className={`${common} bg-white text-black`}
        >
          X
        </div>
      );

    case "REDDIT":
      return (
        <div
          className={`${common} bg-orange-500 text-white`}
        >
          R
        </div>
      );

    case "MANYVIDS":
      return (
        <div
          className={`${common} bg-pink-600 text-white`}
        >
          MV
        </div>
      );

    case "PORNHUB":
      return (
        <div
          className={`${common} bg-orange-400 text-black`}
        >
          PH
        </div>
      );

    case "ONLYFANS":
      return (
        <div
          className={`${common} bg-cyan-500 text-white`}
        >
          OF
        </div>
      );

    case "FANSLY":
      return (
        <div
          className={`${common} bg-blue-500 text-white`}
        >
          FA
        </div>
      );

    case "LOYALFANS":
      return (
        <div
          className={`${common} bg-red-500 text-white`}
        >
          LF
        </div>
      );

    default:
      return (
        <div
          className={`${common} bg-white/[0.08] text-white/70`}
        >
          {platform
            .slice(
              0,
              2,
            )
            .toUpperCase()}
        </div>
      );
  }
}

function getCalendarDays(
  month: Date,
) {
  const firstDay =
    new Date(
      month.getFullYear(),
      month.getMonth(),
      1,
    );

  const start =
    new Date(
      firstDay,
    );

  start.setDate(
    start.getDate() -
      start.getDay(),
  );

  return Array.from(
    {
      length: 42,
    },
    (_, index) => {
      const date =
        new Date(
          start,
        );

      date.setDate(
        start.getDate() +
          index,
      );

      return {
        date,
        currentMonth:
          date.getMonth() ===
          month.getMonth(),
      };
    },
  );
}

function getDateInputValue(
  date: Date,
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}

function formatScheduleButton(
  value: string,
  locale: string,
  fallback: string,
) {
  const date =
    new Date(value.length === 16 ? value + ":00Z" : value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return fallback;
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      timeZone: "UTC",
      month:
        "short",
      day:
        "numeric",
      hour:
        "numeric",
      minute:
        "2-digit",
    },
  ).format(date);
}

function formatFullSchedule(
  value: string,
  locale: string,
) {
  const date =
    new Date(value.length === 16 ? value + ":00Z" : value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      timeZone: "UTC",
      weekday:
        "short",
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
      hour:
        "numeric",
      minute:
        "2-digit",
    },
  ).format(date);
}

function formatSchedulePreview(
  dateValue: string,
  timeValue: string,
  locale: string,
  fallback: string,
) {
  if (
    !dateValue ||
    !timeValue
  ) {
    return fallback;
  }

  return formatFullSchedule(
    `${dateValue}T${timeValue}`,
    locale,
  );
}

function formatTimeValue(
  value: string,
  locale: string,
) {
  const [
    hour,
    minute,
  ] =
    value.split(
      ":",
    );

  const date =
    new Date();

  date.setHours(
    Number(hour),
    Number(minute),
    0,
    0,
  );

  return new Intl.DateTimeFormat(
    locale,
    {
      hour:
        "numeric",
      minute:
        "2-digit",
    },
  ).format(date);
}

function getCreatorName(
  creator: Creator,
  fallback = "Creator",
) {
  return (
    creator.displayName ||
    creator.stageName ||
    creator.name ||
    fallback
  );
}

function getPlatformLabel(
  platform: string,
) {
  return (
    PLATFORM_LABELS[
      platform
    ] ??
    platform
  );
}

function formatBytes(
  value: number,
) {
  if (
    !Number.isFinite(
      value,
    ) ||
    value <= 0
  ) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index =
    Math.min(
      units.length - 1,
      Math.floor(
        Math.log(
          value,
        ) /
          Math.log(
            1024,
          ),
      ),
    );

  const amount =
    value /
    1024 ** index;

  return `${amount.toFixed(
    index === 0
      ? 0
      : amount >= 10
        ? 1
        : 2,
  )} ${units[index]}`;
}
