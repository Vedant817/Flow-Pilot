import { Dialog, DialogHeading } from "@ariakit/react";
import { X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}

export const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message }: ConfirmDialogProps) => {
    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            backdrop={<div className="fixed inset-0 bg-black/50" />}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#1A1A1A] p-6 rounded-lg shadow-lg w-[350px] z-50"
        >
            <div className="flex justify-between items-center mb-4">
                <DialogHeading className="text-white text-lg font-medium">{title}</DialogHeading>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <X size={18} />
                </button>
            </div>
            <p className="text-gray-300 mb-6">{message}</p>
            <div className="flex justify-end gap-3">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-[#252525] text-white rounded-lg hover:bg-[#333]"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className="px-4 py-2 bg-[#00E676] text-black rounded-lg hover:bg-[#00ff84]"
                >
                    Confirm
                </button>
            </div>
        </Dialog>
    );
};
