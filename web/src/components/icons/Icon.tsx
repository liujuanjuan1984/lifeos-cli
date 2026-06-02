import type { ComponentType, SVGProps } from "react";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowLongRightIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  BanknotesIcon,
  BoltIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  FireIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  InboxArrowDownIcon,
  LanguageIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  MapIcon,
  MapPinIcon,
  MoonIcon,
  PauseIcon,
  PencilSquareIcon,
  PlusIcon as HeroPlusIcon,
  SparklesIcon,
  StarIcon,
  SunIcon,
  TagIcon,
  TrashIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import {
  ArrowPathRoundedSquareIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/solid";

export type IconName =
  | "edit"
  | "trash"
  | "x-mark"
  | "chevron-down"
  | "chevron-up"
  | "chevron-left"
  | "chevron-right"
  | "check"
  | "plus"
  | "refresh"
  | "repeat"
  | "settings"
  | "tag"
  | "calendar"
  | "search"
  | "clipboard"
  | "download"
  | "document-text"
  | "document-plus"
  | "book-open"
  | "bolt"
  | "timer"
  | "upload"
  | "sparkles"
  | "eye"
  | "warning"
  | "inbox"
  | "pause"
  | "forward"
  | "pin"
  | "star"
  | "fire"
  | "sun"
  | "moon"
  | "link"
  | "chart"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up"
  | "arrow-down"
  | "language"
  | "map"
  | "people"
  | "switch"
  | "thumb-up"
  | "thumb-down"
  | "banknotes";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  title?: string;
}

const ICON_COMPONENTS: Record<
  IconName,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  edit: PencilSquareIcon,
  trash: TrashIcon,
  "x-mark": XMarkIcon,
  "chevron-down": ChevronDownIcon,
  "chevron-up": ChevronUpIcon,
  "chevron-left": ChevronLeftIcon,
  "chevron-right": ChevronRightIcon,
  check: CheckIcon,
  plus: HeroPlusIcon,
  refresh: ArrowPathIcon,
  repeat: ArrowPathRoundedSquareIcon,
  settings: Cog6ToothIcon,
  tag: TagIcon,
  calendar: CalendarDaysIcon,
  search: MagnifyingGlassIcon,
  clipboard: ClipboardDocumentListIcon,
  download: ArrowDownTrayIcon,
  "document-text": DocumentTextIcon,
  "document-plus": DocumentPlusIcon,
  "book-open": BookOpenIcon,
  bolt: BoltIcon,
  timer: ClockIcon,
  upload: ArrowUpTrayIcon,
  sparkles: SparklesIcon,
  eye: EyeIcon,
  warning: ExclamationTriangleIcon,
  inbox: InboxArrowDownIcon,
  pause: PauseIcon,
  forward: ArrowLongRightIcon,
  pin: MapPinIcon,
  star: StarIcon,
  fire: FireIcon,
  sun: SunIcon,
  moon: MoonIcon,
  link: LinkIcon,
  chart: ChartBarIcon,
  "arrow-left": ArrowLeftIcon,
  "arrow-right": ArrowRightIcon,
  "arrow-up": ArrowUpIcon,
  "arrow-down": ArrowDownIcon,
  language: LanguageIcon,
  map: MapIcon,
  people: UserGroupIcon,
  switch: ArrowsRightLeftIcon,
  "thumb-up": HandThumbUpIcon,
  "thumb-down": HandThumbDownIcon,
  banknotes: BanknotesIcon,
};

function getAriaAttributes(title?: string) {
  if (title && title.trim().length > 0) {
    return {
      role: "img" as const,
      "aria-hidden": undefined,
    };
  }
  return {
    role: undefined,
    "aria-hidden": true,
  } as const;
}

export function Icon({
  name,
  size = 16,
  className = "",
  title,
  ...rest
}: IconProps) {
  const Component = ICON_COMPONENTS[name];

  if (!Component) {
    return null;
  }

  const resolvedClassName = className
    ? `inline-block ${className}`
    : "inline-block";

  const ariaAttributes = getAriaAttributes(title);

  return (
    <Component
      width={size}
      height={size}
      className={resolvedClassName}
      {...ariaAttributes}
      {...(title ? { title } : {})}
      {...rest}
    />
  );
}
