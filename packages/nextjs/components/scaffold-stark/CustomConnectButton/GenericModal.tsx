const GenericModal = ({
  children,
  className = "modal-box modal-border bg-modal rounded-[8px] border flex flex-col relative w-full max-w-xs p-6",
  modalId,
  isOpen,
  onClose,
}: {
  children: React.ReactNode;
  className?: string;
  modalId: string;
  isOpen?: boolean;
  onClose?: () => void;
}) => {
  const controlled = isOpen !== undefined;

  return (
    <label
      htmlFor={controlled ? undefined : modalId}
      className={`modal backdrop-blur-sm cursor-pointer${controlled && isOpen ? " modal-open" : ""}`}
      onClick={
        controlled
          ? (e) => {
              if (e.target === e.currentTarget && onClose) onClose();
            }
          : undefined
      }
    >
      <label className={className} style={{ minHeight: "auto" }}>
        <input className="h-0 w-0 absolute top-0 left-0" />
        {children}
      </label>
    </label>
  );
};

export default GenericModal;
