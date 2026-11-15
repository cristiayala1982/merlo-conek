import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Componente global de modal de opciones estandarizado.
 * Diseño consistente con SelectorReporteModal.
 */
export default function SelectorOpcionesModal({ visible, onClose, opciones, titulo = 'Opciones' }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.menuContent}>
          <View style={styles.menuIndicator} />
          <Text style={styles.menuTitle}>{titulo}</Text>

          {opciones.map((opcion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuOption}
              onPress={() => {
                opcion.onPress();
                onClose();
              }}
            >
              <Ionicons name={opcion.icon} size={22} color={opcion.color || '#374151'} />
              <Text style={[styles.menuOptionText, opcion.color && { color: opcion.color }]}>
                {opcion.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.menuCancelBtn} onPress={onClose}>
            <Text style={styles.menuCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  menuIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 15,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuOptionText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
    flexWrap: 'wrap',
  },
  menuCancelBtn: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});