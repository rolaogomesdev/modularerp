// Design system (docs/architecture/09-design-system.md).
// Modules import from here or via @repo/ui/components/<name> subpaths —
// never from @radix-ui or raw Tailwind primitives.

export { cn } from "./lib/utils";

// form controls
export { Button, buttonVariants, type ButtonProps } from "./components/button";
export { IconButton, type IconButtonProps } from "./components/icon-button";
export { Input } from "./components/input";
export { Textarea } from "./components/textarea";
export { Field, Label } from "./components/field";
export { NativeSelect } from "./components/native-select";
export { Checkbox } from "./components/checkbox";
export { Switch } from "./components/switch";
export { RadioGroup, RadioGroupItem } from "./components/radio-group";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/select";
export { SearchInput } from "./components/search-input";

// overlays
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "./components/dialog";
export {
  Sheet,
  SheetTrigger,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
  sheetVariants,
} from "./components/sheet";
export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from "./components/popover";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./components/dropdown-menu";
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./components/tooltip";
export { Toaster, toast } from "./components/toast";

// display
export { Badge, badgeVariants } from "./components/badge";
export { Avatar, AvatarImage, AvatarFallback } from "./components/avatar";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";
export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./components/accordion";
export { Skeleton } from "./components/skeleton";
export { Spinner, spinnerVariants } from "./components/spinner";
export { Progress } from "./components/progress";

// composed ERP vocabulary
export { PageHeader } from "./components/page-header";
export { EmptyState } from "./components/empty-state";
export { ErrorState } from "./components/error-state";
export { ListItem } from "./components/list-item";
export { StatCard, statCardVariants } from "./components/stat-card";
export {
  ApprovalBanner,
  approvalBannerVariants,
} from "./components/approval-banner";
export { Timeline, TimelineItem } from "./components/timeline";
export { ResponsiveTable, ResponsiveRow } from "./components/responsive-table";
