export const formatTime = (value?: string) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const formatChatTitle = (title?: string) =>
  title && title.trim().length > 0 ? title : "Untitled chat";
